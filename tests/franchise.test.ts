import { describe, expect, it } from 'vitest';
import { createNewGame, decoBonus, franchiseCost, type GameState } from '../src/sim';
import { act, lastId, T0, tryAct } from './helpers';

function withBakery(built: boolean): GameState {
  let s = createNewGame(T0, 21);
  s = { ...s, coins: 20000, goods: 300, level: 10, energy: 100 };
  s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, T0);
  const id = lastId(s);
  if (built) for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0);
  return s;
}

describe('franchises', () => {
  it('cost 80% of the shop and need a finished shop of your own', () => {
    expect(franchiseCost('bakery')).toBe(160);
    expect(franchiseCost('cottage')).toBe(0);
    expect(tryAct(withBakery(false), { t: 'franchisePay', item: 'bakery' }, T0)).toMatchObject({ ok: false, error: 'notOwned' });
    const s = withBakery(true);
    const paid = act(s, { t: 'franchisePay', item: 'bakery' }, T0);
    expect(paid.coins).toBe(s.coins - 160);
    expect(paid.stats.franchise).toBe(1);
    expect(tryAct({ ...s, coins: 100 }, { t: 'franchisePay', item: 'bakery' }, T0)).toMatchObject({ ok: false, error: 'noCoins' });
    expect(tryAct(s, { t: 'franchisePay', item: 'cottage' }, T0)).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('supply runs take goods, pay the reward once and never go below zero goods', () => {
    const s = withBakery(true);
    const after = act(s, { t: 'franchiseSupply', goods: 5, reward: { coins: 20, xp: 5 }, key: 'fsupply:a' }, T0);
    expect(after.goods).toBe(s.goods - 5);
    expect(after.coins).toBe(s.coins + 20);
    expect(tryAct(after, { t: 'franchiseSupply', goods: 5, reward: { coins: 20 }, key: 'fsupply:a' }, T0)).toMatchObject({ ok: false, error: 'alreadyDone' });
    const broke = act({ ...s, goods: 2 }, { t: 'franchiseSupply', goods: 5, reward: {}, key: 'fsupply:b' }, T0);
    expect(broke.goods).toBe(0);
    expect(tryAct(s, { t: 'franchiseSupply', goods: -1, reward: {}, key: 'fsupply:c' }, T0)).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('Empty Lots need a road and the HQ boosts nearby shops like a decoration', () => {
    let s = withBakery(true);
    expect(tryAct(s, { t: 'place', item: 'emptylot', x: 3, y: 24, rot: 0 }, T0)).toMatchObject({ ok: false });
    s = act(s, { t: 'place', item: 'emptylot', x: 13, y: 18, rot: 0 }, T0);
    expect(s.objects[lastId(s)]!.built).toBe(true);
    const bakery = Object.values(s.objects).find((o) => o.item === 'bakery')!;
    const before = decoBonus(s, bakery);
    s = act(s, { t: 'place', item: 'hq', x: 6, y: 12, rot: 0 }, T0);
    const hq = lastId(s);
    for (let i = 0; i < 5; i++) s = act(s, { t: 'build', id: hq }, T0);
    expect(decoBonus(s, bakery)).toBe(before + 10);
  });
});
