// "Done means": a new visitor can, within 10 minutes, build homes and a shop,
// harvest crops and complete at least 5 goals. This scripts that session
// against the pure simulation with realistic timing.
import { describe, expect, it } from 'vitest';
import { createNewGame, cropStage, population, type GameState } from '../src/sim';
import { act, findObj, lastId, MIN, T0 } from './helpers';

const SEC = 1000;

describe('first ten minutes', () => {
  it('completes the opening tutorial goals in under 10 minutes', () => {
    let s: GameState = createNewGame(T0, 2024);
    let t = T0 + 5 * SEC;

    const cottage = findObj(s, 'cottage', (o) => (o.readyAt ?? 0) <= T0);
    s = act(s, { t: 'collect', id: cottage.id }, t);

    const plots = Object.values(s.objects).filter((o) => o.item === 'plot');
    t += 10 * SEC;
    for (const p of plots.filter((o) => o.crop)) s = act(s, { t: 'harvest', id: p.id }, t);
    t += 10 * SEC;
    for (const p of plots) s = act(s, { t: 'plant', id: p.id, crop: 'strawberry' }, t);
    const plantedAt = t;

    t += 20 * SEC;
    s = act(s, { t: 'place', item: 'cottage', x: 14, y: 18, rot: 0 }, t);
    const home = lastId(s);
    for (let i = 0; i < 3; i++) s = act(s, { t: 'build', id: home }, (t += 2 * SEC));

    t += 20 * SEC;
    s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, t);
    const bakery = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id: bakery }, (t += 2 * SEC));
    s = act(s, { t: 'supply', id: bakery }, (t += 5 * SEC));

    t = T0 + 4 * MIN;
    s = act(s, { t: 'collect', id: bakery }, t);
    s = act(s, { t: 'place', item: 'road', x: 33, y: 15, rot: 0 }, (t += 10 * SEC));
    s = act(s, { t: 'place', item: 'road', x: 18, y: 0, rot: 0 }, (t += 5 * SEC));

    t = plantedAt + 5 * MIN + 5 * SEC;
    for (const p of plots) {
      if (cropStage(s, s.objects[p.id]!, t) === 'ripe') s = act(s, { t: 'harvest', id: p.id }, (t += 2 * SEC));
    }
    s = act(s, { t: 'place', item: 'flowerbed', x: 7, y: 12, rot: 0 }, (t += 10 * SEC));
    s = act(s, { t: 'place', item: 'flowerbed', x: 6, y: 12, rot: 0 }, (t += 5 * SEC));

    expect(t - T0).toBeLessThan(10 * MIN);
    expect(s.goals.done.length).toBeGreaterThanOrEqual(5);
    expect(s.goals.done).toEqual(expect.arrayContaining(['tut_rent', 'tut_harvest', 'tut_home', 'tut_bakery', 'tut_sale']));
    expect(s.objects[home]!.built).toBe(true);
    expect(s.objects[bakery]!.built).toBe(true);
    expect(s.stats.harvest).toBeGreaterThanOrEqual(4);
    expect(population(s)).toBeGreaterThan(12);
    expect(s.goals.active.length).toBeGreaterThanOrEqual(3);
  });
});
