import { describe, expect, it } from 'vitest';
import {
  advance,
  createNewGame,
  cropStage,
  dailyAvailable,
  dailyNextDay,
  dayKey,
  energyCap,
  shipReady,
  trainReady,
  type GameState,
} from '../src/sim';
import { shiftDayKey, shiftTime } from '../src/sim/timeskip';
import { act, findObj, HOUR, lastId, MIN, T0 } from './helpers';

const DAY = 24 * HOUR;
const AT = T0 + 10_000;

/** A city with every kind of timer running: crops, rent, a stocked shop, boats, the train, low energy. */
function busyCity(): GameState {
  let s = createNewGame(T0, 11);
  s = { ...s, coins: 1_000_000, level: 20, energy: 200, goods: 300 };
  const plots = Object.values(s.objects).filter((o) => o.item === 'plot');
  for (const p of plots.filter((o) => o.crop)) s = act(s, { t: 'harvest', id: p.id }, T0);
  const crops = ['strawberry', 'eggplant', 'watermelon', 'carrot'];
  plots.forEach((p, i) => {
    s = act(s, { t: 'plant', id: p.id, crop: crops[i]! }, T0 + 1000);
  });
  for (const c of Object.values(s.objects).filter((o) => o.item === 'cottage' && (o.readyAt ?? 0) <= T0 + 2000)) {
    s = act(s, { t: 'collect', id: c.id }, T0 + 2000);
  }
  s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, T0 + 3000);
  const bakery = lastId(s);
  for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id: bakery }, T0 + 3000);
  s = act(s, { t: 'supply', id: bakery }, T0 + 4000);
  s = act(s, { t: 'place', item: 'pier', x: 12, y: 33, rot: 0 }, T0 + 5000);
  const pier = lastId(s);
  for (let i = 0; i < 5; i++) s = act(s, { t: 'build', id: pier }, T0 + 5000);
  s = act(s, { t: 'ship', id: pier, slot: 0, contract: 'gullwing' }, T0 + 6000);
  s = act(s, { t: 'ship', id: pier, slot: 1, contract: 'pebble' }, T0 + 6000);
  s = act(s, { t: 'train', route: 'hillside', stops: ['npc:pip'] }, T0 + 7000);
  return { ...s, energy: 2, volunteers: 0 };
}

/** Lists every difference between two states (numbers may differ by float noise only). */
function differences(a: unknown, b: unknown, path = 'state', out: string[] = []): string[] {
  if (typeof a === 'number' && typeof b === 'number') {
    if (!(Math.abs(a - b) <= 1e-6)) out.push(`${path}: ${a} vs ${b}`);
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) differences(ra[k], rb[k], `${path}.${k}`, out);
  } else if (a !== b) {
    out.push(`${path}: ${String(a)} vs ${String(b)}`);
  }
  return out;
}

describe('dev time skip', () => {
  it('gives exactly the same city as really waiting', () => {
    const s = busyCity();
    for (const ms of [5 * MIN, 15 * MIN, HOUR, 4 * HOUR, 8 * HOUR, DAY, 3 * DAY + 7 * MIN]) {
      const waited = advance(s, AT + ms);
      const skipped = advance(shiftTime(s, ms), AT);
      // Same city, only every clock reads `ms` earlier.
      expect(differences(skipped, shiftTime(waited, ms)), `skip of ${ms / MIN} min`).toEqual([]);
    }
  });

  it('grows crops, readies rent, refills energy and brings boats and the train home', () => {
    const s = busyCity();
    const pier = findObj(s, 'pier').id;
    const stage = (st: GameState, crop: string) => cropStage(st, findObj(st, 'plot', (o) => o.crop?.id === crop), st.now);

    const fiveMin = advance(shiftTime(s, 5 * MIN), AT);
    expect(stage(fiveMin, 'strawberry')).toBe('ripe');
    expect(stage(fiveMin, 'eggplant')).toBe('seed');
    expect(Object.values(fiveMin.objects).filter((o) => o.item === 'cottage').every((o) => (o.readyAt ?? 0) <= fiveMin.now)).toBe(true);
    expect(findObj(fiveMin, 'bakery').shop!.state).toBe('soldout');
    expect(shipReady(fiveMin.objects[pier]!, 1, fiveMin.now)).toBe(true);
    expect(shipReady(fiveMin.objects[pier]!, 0, fiveMin.now)).toBe(false);
    expect(trainReady(fiveMin, fiveMin.now)).toBe(false);
    expect(fiveMin.energy).toBe(3);

    const hour = advance(shiftTime(s, HOUR), AT);
    expect(stage(hour, 'eggplant')).toBe('ripe');
    expect(stage(hour, 'strawberry')).toBe('withered');
    expect(stage(hour, 'watermelon')).toBe('seed');
    expect(shipReady(hour.objects[pier]!, 0, hour.now)).toBe(true);
    expect(trainReady(hour, hour.now)).toBe(true);
    expect(hour.energy).toBe(22);

    const eight = advance(shiftTime(s, 8 * HOUR), AT);
    expect(stage(eight, 'watermelon')).toBe('ripe');
    expect(stage(eight, 'carrot')).toBe('ripe');
    expect(eight.energy).toBe(energyCap(eight.level));
    expect(eight.volunteers).toBe(2);
  });

  it('starts a new day only for skips of a day or more', () => {
    const today = dayKey(T0, 0);
    const yesterday = dayKey(T0 - DAY, 0);
    let s = createNewGame(T0, 12);
    s = act(s, { t: 'claimDaily', tz: 0 }, T0);
    s = act(s, { t: 'npcDaily', day: today, helps: true }, T0);

    const sameDay = advance(shiftTime(s, 8 * HOUR), AT);
    expect(dailyAvailable(sameDay, AT, 0)).toBe(false);
    expect(sameDay.npc).toEqual(s.npc);

    const next = advance(shiftTime(s, DAY), AT);
    expect(dailyAvailable(next, AT, 0)).toBe(true);
    expect(dailyNextDay(next, AT, 0)).toBe(2);
    for (const n of Object.values(next.npc)) expect([n.giftDay, n.visitDay]).toEqual([yesterday, yesterday]);
    expect(next.gifts.length).toBeGreaterThan(0);
    expect(next.gifts.every((g) => g.id.endsWith(yesterday))).toBe(true);

    // The neighbors come by again today, and their new gifts don't clash with yesterday's.
    const again = act(next, { t: 'npcDaily', day: today, helps: true }, AT);
    const ids = again.gifts.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.endsWith(today))).toHaveLength(next.gifts.length);
  });

  it('moves day keys across month, year and leap-day boundaries', () => {
    expect(shiftDayKey('2026-10-19', 3)).toBe('2026-10-16');
    expect(shiftDayKey('2026-03-01', 1)).toBe('2026-02-28');
    expect(shiftDayKey('2028-03-01', 1)).toBe('2028-02-29');
    expect(shiftDayKey('2027-01-01', 1)).toBe('2026-12-31');
    expect(shiftDayKey('2026-10-19', 0)).toBe('2026-10-19');
    expect(shiftDayKey('', 1)).toBe('');
    expect(shiftDayKey('not a day', 1)).toBe('not a day');
  });

  it('never changes the state it is given', () => {
    const s = busyCity();
    const copy = structuredClone(s);
    shiftTime(s, DAY);
    expect(s).toEqual(copy);
    expect(shiftTime(s, 0)).toEqual(s);
    expect(shiftTime(s, -HOUR)).toEqual(s);
  });
});
