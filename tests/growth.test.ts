import { describe, expect, it } from 'vitest';
import { advance, createNewGame, expansionCost, goodsCap, popCap, shopGoods, type GameState } from '../src/sim';
import { act, findObj, HOUR, lastId, MIN, T0, tryAct } from './helpers';

function rich(s: GameState, extra: Partial<GameState> = {}): GameState {
  return { ...s, coins: 1_000_000, level: 20, energy: 200, goods: 2000, permits: 20, ...extra };
}

describe('harbor', () => {
  it('only fits on the shore and runs timed boat contracts', () => {
    let s = rich(createNewGame(T0, 1), { goods: 0 });
    expect(tryAct(s, { t: 'place', item: 'pier', x: 12, y: 20, rot: 0 }, T0)).toMatchObject({ ok: false, error: 'coast' });
    s = act(s, { t: 'place', item: 'pier', x: 12, y: 33, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 5; i++) s = act(s, { t: 'build', id }, T0);
    expect(s.objects[id]!.built).toBe(true);
    expect(s.objects[id]!.ships).toHaveLength(2);
    const coins = s.coins;
    s = act(s, { t: 'ship', id, slot: 0, contract: 'pebble' }, T0);
    expect(s.coins).toBe(coins - 25);
    expect(tryAct(s, { t: 'ship', id, slot: 0, contract: 'pebble' }, T0)).toMatchObject({ ok: false, error: 'busy' });
    expect(tryAct(s, { t: 'unload', id, slot: 0 }, T0 + MIN)).toMatchObject({ ok: false, error: 'notReady' });
    const goods = s.goods;
    s = act(s, { t: 'unload', id, slot: 0 }, T0 + 5 * MIN);
    expect(s.goods).toBeGreaterThanOrEqual(goods + 19);
    expect(s.objects[id]!.ships![0]).toBeNull();
  });

  it('long voyages always bring back a building part', () => {
    let s = rich(createNewGame(T0, 2), { goods: 0 });
    s = act(s, { t: 'place', item: 'pier', x: 12, y: 33, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 5; i++) s = act(s, { t: 'build', id }, T0);
    const parts = () => Object.values(s.parts).reduce((a, b) => a + b, 0);
    const before = parts();
    s = act(s, { t: 'ship', id, slot: 1, contract: 'saltmarsh' }, T0);
    s = act(s, { t: 'unload', id, slot: 1 }, T0 + 9 * HOUR);
    expect(parts()).toBeGreaterThan(before);
  });

  it('pier upgrades add berths and storage', () => {
    let s = rich(createNewGame(T0, 3), { parts: { brick: 10, toolkit: 10, paint: 10 } });
    s = act(s, { t: 'place', item: 'pier', x: 12, y: 33, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 5; i++) s = act(s, { t: 'build', id }, T0);
    const cap = goodsCap(s);
    s = act(s, { t: 'upgrade', id }, T0);
    expect(s.objects[id]!.level).toBe(2);
    expect(s.objects[id]!.ships).toHaveLength(3);
    expect(goodsCap(s)).toBeGreaterThan(cap);
    expect(s.parts.brick).toBe(7);
  });
});

describe('railway', () => {
  it('opens at level 5; trains buy goods and stops raise the payout', () => {
    let s = createNewGame(T0, 4);
    expect(findObj(s, 'station')).toBeTruthy();
    expect(tryAct(s, { t: 'train', route: 'valley', stops: [] }, T0)).toMatchObject({ ok: false, error: 'locked' });
    s = rich(s, { goods: 100 });
    s = act(s, { t: 'train', route: 'valley', stops: ['npc:pip', 'npc:rosa', 'npc:pip', 'bogus'] }, T0);
    expect(s.train!.stops).toEqual(['npc:pip', 'npc:rosa']);
    expect(tryAct(s, { t: 'train', route: 'market', stops: [] }, T0)).toMatchObject({ ok: false, error: 'busy' });
    expect(tryAct(s, { t: 'trainCollect' }, T0 + MIN)).toMatchObject({ ok: false, error: 'notReady' });
    const goods = s.goods;
    s = act(s, { t: 'trainCollect' }, T0 + 6 * MIN);
    expect(s.goods - goods).toBeGreaterThanOrEqual(50 + 2 * 10);
    expect(s.train).toBeNull();
  });

  it('sell routes turn goods into coins', () => {
    let s = rich(createNewGame(T0, 5), { goods: 300 });
    const goods = s.goods;
    s = act(s, { t: 'train', route: 'market', stops: ['npc:rosa'] }, T0);
    expect(s.goods).toBe(goods - 50);
    const coins = s.coins;
    s = act(s, { t: 'trainCollect' }, T0 + 5 * MIN);
    expect(s.coins - coins).toBeGreaterThanOrEqual(210 + 25);
  });
});

describe('upgrades and mastery', () => {
  it('upgrading a shop costs coins and parts and raises its stock and payout', () => {
    let s = rich(createNewGame(T0, 6), { parts: { brick: 5, paint: 5, toolkit: 5 } });
    s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0);
    const base = shopGoods(s.objects[id]!, { goods: 10 } as never);
    s = act(s, { t: 'upgrade', id }, T0);
    expect(s.objects[id]!.level).toBe(2);
    expect(shopGoods(s.objects[id]!, { goods: 10, upgrades: [{ coins: 0, mult: 1.5 }] } as never)).toBe(base * 1.5);
    expect(s.parts.brick).toBe(3);
    s = { ...s, parts: {} };
    expect(tryAct(s, { t: 'upgrade', id }, T0)).toMatchObject({ ok: false, error: 'noParts' });
  });

  it('community upgrades raise the population cap', () => {
    let s = rich(createNewGame(T0, 7), { volunteers: 10, parts: { brick: 9, toolkit: 9, paint: 9 } });
    s = act(s, { t: 'place', item: 'townhall', x: 21, y: 11, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0);
    for (let i = 0; i < 3; i++) s = act(s, { t: 'staff', id, source: 'vol' }, T0);
    s = act(s, { t: 'build', id }, T0);
    const cap = popCap(s);
    s = act(s, { t: 'upgrade', id }, T0);
    expect(popCap(s)).toBe(cap + 50);
  });
});

describe('land expansion', () => {
  it('needs coins, population and N permits for the Nth expansion; only adjacent land', () => {
    let s = rich(createNewGame(T0, 8), { permits: 0 });
    expect(tryAct(s, { t: 'expand', lx: 3, ly: 0 }, T0)).toMatchObject({ ok: false });
    expect(tryAct(s, { t: 'expand', lx: 5, ly: 0 }, T0)).toMatchObject({ ok: false, error: 'invalid' });
    expect(tryAct(s, { t: 'expand', lx: 0, ly: 3 }, T0)).toMatchObject({ ok: false, error: 'invalid' }); // the sea
    s = { ...s, permits: 1 };
    // starter town has 12 residents; first expansion needs 40
    expect(tryAct(s, { t: 'expand', lx: 3, ly: 0 }, T0)).toMatchObject({ ok: false, error: 'locked' });
    for (const x of [2, 4, 6, 8, 10]) s = act(s, { t: 'place', item: 'cottage', x, y: 13, rot: 0 }, T0 + 1);
    for (const o of Object.values(s.objects).filter((o) => !o.built)) for (let i = 0; i < 3; i++) s = act(s, { t: 'build', id: o.id }, T0 + 2);
    const cost = expansionCost(s);
    expect(cost.permits).toBe(1);
    const permits = s.permits; // goal rewards may have added some
    s = act(s, { t: 'expand', lx: 3, ly: 0 }, T0 + 3);
    expect(s.lots).toContain('3,0');
    expect(s.permits).toBe(permits - 1);
    expect(expansionCost(s).permits).toBe(2);
    // the new land can be built on
    expect(tryAct(s, { t: 'place', item: 'flowerbed', x: 40, y: 5, rot: 0 }, T0 + 4)).toMatchObject({ ok: true });
  });
});

describe('wonders', () => {
  function withHive(): { s: GameState; id: number } {
    let s = rich(createNewGame(T0, 9), { parts: { brick: 20, paint: 20, toolkit: 20, key: 6 } });
    s = act(s, { t: 'place', item: 'greathive', x: 21, y: 9, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 10; i++) s = act(s, { t: 'build', id }, T0);
    expect(s.objects[id]!.built).toBe(false); // needs parts
    s = act(s, { t: 'deliverParts', id }, T0);
    return { s, id };
  }

  it('needs parts after the frame, then fires a timed town-wide boost', () => {
    const { s: built, id } = withHive();
    let s = built;
    expect(s.objects[id]!.built).toBe(true);
    // plant first, fire the boost when the crop is nearly ripe
    const plot = findObj(s, 'plot', (o) => !o.crop);
    s = act({ ...s, goods: 0 }, { t: 'plant', id: plot.id, crop: 'strawberry' }, T0);
    s = act(s, { t: 'boost', id }, T0 + 5 * MIN);
    expect(s.boosts[0]!.id).toBe('goldenharvest');
    expect(tryAct(s, { t: 'boost', id }, T0 + 6 * MIN)).toMatchObject({ ok: false, error: 'notReady' });
    // crops pay double goods during the boost
    const goods = s.goods;
    s = act(s, { t: 'harvest', id: plot.id }, T0 + 5 * MIN + 30_000);
    expect(s.goods - goods).toBeGreaterThanOrEqual(30);
    // boost expires
    expect(advance(s, T0 + 16 * MIN).boosts).toHaveLength(0);
  });

  it('can be recharged early with wonder keys', () => {
    let { s, id } = withHive();
    s = act(s, { t: 'boost', id }, T0);
    s = act(s, { t: 'recharge', id }, T0 + MIN);
    expect(s.parts.key).toBe(0);
    expect(tryAct(s, { t: 'boost', id }, T0 + 2 * MIN)).toMatchObject({ ok: true });
  });
});
