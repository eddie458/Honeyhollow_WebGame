import { describe, expect, it } from 'vitest';
import {
  advance,
  bonusStage,
  content,
  createNewGame,
  cropStage,
  decoBonus,
  energyCap,
  goodsCap,
  levelXp,
  mood,
  popCap,
  population,
  readSave,
  SaveError,
  wrapSave,
} from '../src/sim';
import { act, actE, findObj, HOUR, lastId, MIN, T0, tryAct } from './helpers';

describe('new game', () => {
  it('starts with the documented resources and a small town', () => {
    const s = createNewGame(T0, 42);
    expect(s.coins).toBe(7000);
    expect(s.energy).toBe(20);
    expect(s.level).toBe(1);
    expect(population(s)).toBe(12);
    expect(popCap(s)).toBe(50);
    expect(goodsCap(s)).toBe(350);
    expect(s.lots).toHaveLength(9);
    expect(s.goals.active.length).toBeGreaterThanOrEqual(3);
    expect(mood(s)).toBe('happy');
  });

  it('has no monetisation fields in the state', () => {
    const s = createNewGame(T0, 1) as unknown as Record<string, unknown>;
    for (const k of Object.keys(s)) expect(k.toLowerCase()).not.toMatch(/cash|gem|premium|purchase/);
  });
});

describe('houses and rent', () => {
  it('collects rent for 1 energy and restarts the timer', () => {
    let s = createNewGame(T0, 7);
    const cot = findObj(s, 'cottage', (o) => (o.readyAt ?? 0) <= T0);
    const { state, events } = actE(s, { t: 'collect', id: cot.id }, T0 + 1000);
    s = state;
    const bonusEnergy = events.flatMap((e) => (e.type === 'drops' ? e.drops : [])).filter((d) => d.kind === 'energy').reduce((n, d) => n + d.amount, 0);
    const leveled = events.some((e) => e.type === 'levelUp');
    if (!leveled) expect(s.energy).toBe(19 + bonusEnergy);
    expect(s.coins).toBeGreaterThan(7000);
    expect(events.some((e) => e.type === 'drops')).toBe(true);
    expect(s.goals.done).toContain('tut_rent');
    expect(tryAct(s, { t: 'collect', id: cot.id }, T0 + 2000)).toMatchObject({ ok: false, error: 'notReady' });
    s = act(s, { t: 'collect', id: cot.id }, T0 + 1000 + 5 * MIN);
    expect(s.energy).toBeLessThan(20);
  });

  it('enforces road access, land ownership and overlap when placing', () => {
    const s = createNewGame(T0, 7);
    expect(tryAct(s, { t: 'place', item: 'cottage', x: 14, y: 18, rot: 0 }, T0)).toMatchObject({ ok: true });
    expect(tryAct(s, { t: 'place', item: 'cottage', x: 14, y: 24, rot: 0 }, T0)).toMatchObject({ ok: false, error: 'needsRoad' });
    expect(tryAct(s, { t: 'place', item: 'cottage', x: 6, y: 18, rot: 0 }, T0)).toMatchObject({ ok: false, error: 'blocked' });
    expect(tryAct(s, { t: 'place', item: 'cottage', x: 40, y: 15, rot: 0 }, T0)).toMatchObject({ ok: false, error: 'notOwned' });
    expect(tryAct(s, { t: 'place', item: 'road', x: 4, y: 24, rot: 0 }, T0)).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('builds with clicks, delivers residents and respects the population cap', () => {
    let s = createNewGame(T0, 7);
    s = act(s, { t: 'place', item: 'cottage', x: 14, y: 18, rot: 0 }, T0);
    const id = lastId(s);
    expect(s.objects[id]!.built).toBe(false);
    s = act(s, { t: 'build', id }, T0 + 1000);
    s = act(s, { t: 'build', id }, T0 + 2000);
    const { state, events } = actE(s, { t: 'build', id }, T0 + 3000);
    expect(state.objects[id]!.built).toBe(true);
    expect(events.some((e) => e.type === 'moveIn')).toBe(true);
    expect(population(state)).toBe(18);
    // Fill up to the cap of 50 with cottages (6 each, reserved while building).
    let t = state;
    let placed = 0;
    for (let x = 3; x < 33 && placed < 10; x += 2) {
      const r = tryAct(t, { t: 'place', item: 'cottage', x, y: 13, rot: 0 }, T0 + 4000);
      if (r.ok) {
        t = r.state;
        placed++;
      } else if (r.error === 'popCap') break;
    }
    expect(tryAct(t, { t: 'place', item: 'cottage', x: 22, y: 18, rot: 0 }, T0 + 5000)).toMatchObject({ ok: false, error: 'popCap' });
  });
});

describe('farming', () => {
  it('plants for free energy, ripens on time and withers after 2x grow time', () => {
    let s = createNewGame(T0, 3);
    const plot = findObj(s, 'plot', (o) => !o.crop);
    s = act(s, { t: 'plant', id: plot.id, crop: 'strawberry' }, T0);
    expect(s.energy).toBe(20);
    expect(s.coins).toBe(7000 - 20);
    const p = () => s.objects[plot.id]!;
    expect(cropStage(s, p(), T0 + 1 * MIN)).toBe('seed');
    expect(cropStage(s, p(), T0 + 4 * MIN)).toBe('growing');
    expect(cropStage(s, p(), T0 + 5 * MIN)).toBe('ripe');
    expect(cropStage(s, p(), T0 + 14 * MIN)).toBe('ripe');
    expect(cropStage(s, p(), T0 + 15 * MIN)).toBe('withered');
    expect(tryAct(s, { t: 'harvest', id: plot.id }, T0 + 16 * MIN)).toMatchObject({ ok: false, error: 'notReady' });
    s = act(s, { t: 'clearPlot', id: plot.id }, T0 + 16 * MIN);
    expect(s.objects[plot.id]!.crop).toBeNull();
  });

  it('never withers with the no-withering setting', () => {
    let s = createNewGame(T0, 3);
    s = act(s, { t: 'settings', noWither: true }, T0);
    const plot = findObj(s, 'plot', (o) => !o.crop);
    s = act(s, { t: 'plant', id: plot.id, crop: 'strawberry' }, T0);
    expect(cropStage(s, s.objects[plot.id]!, T0 + 10 * HOUR)).toBe('ripe');
  });

  it('harvest gives goods for 1 energy and counts mastery', () => {
    let s = createNewGame(T0, 3);
    const ripe = Object.values(s.objects).filter((o) => o.crop);
    expect(ripe).toHaveLength(2);
    for (const o of ripe) s = act(s, { t: 'harvest', id: o.id }, T0 + 1000);
    expect(s.goods).toBeGreaterThanOrEqual(30);
    expect(s.energy).toBeLessThanOrEqual(18 + 2); // bonus energy drops possible
    expect(s.mastery.strawberry).toBe(2);
    expect(s.goals.done).toContain('tut_harvest');
  });
});

describe('businesses', () => {
  function cityWithBakery() {
    let s = createNewGame(T0, 11);
    s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0 + i * 1000);
    for (const o of Object.values(s.objects).filter((x) => x.crop)) s = act(s, { t: 'harvest', id: o.id }, T0 + 5000);
    return { s, id };
  }

  it('opens only when fully stocked, sells over time and pays when collected', () => {
    let { s, id } = cityWithBakery();
    expect(s.objects[id]!.shop!.state).toBe('opening');
    s = act(s, { t: 'supply', id }, T0 + 10_000);
    expect(s.objects[id]!.shop!.state).toBe('open');
    const later = advance(s, T0 + 10_000 + 3 * MIN);
    expect(later.objects[id]!.shop!.state).toBe('soldout');
    expect(later.objects[id]!.shop!.served).toBe(10);
    const coinsBefore = later.coins;
    s = act(later, { t: 'collect', id }, T0 + 10_000 + 3 * MIN);
    expect(s.coins).toBeGreaterThanOrEqual(coinsBefore + 40);
    expect(s.objects[id]!.shop!.state).toBe('empty');
    expect(tryAct(s, { t: 'collect', id }, T0 + 11 * MIN)).toMatchObject({ ok: false, error: 'notReady' });
  });

  it('refuses partial stocking', () => {
    let { s, id } = cityWithBakery();
    s = { ...s, goods: 5 };
    expect(tryAct(s, { t: 'supply', id }, T0 + 20_000)).toMatchObject({ ok: false, error: 'noGoods' });
  });

  it('decorations within 3 tiles raise payouts', () => {
    let { s, id } = cityWithBakery();
    const base = decoBonus(s, s.objects[id]!); // a starter tree may already be in reach
    s = act(s, { t: 'place', item: 'flowerbed', x: 7, y: 12, rot: 0 }, T0 + 20_000);
    expect(decoBonus(s, s.objects[id]!)).toBe(base + 3);
    s = act(s, { t: 'place', item: 'bench', x: 9, y: 12, rot: 0 }, T0 + 20_000);
    expect(decoBonus(s, s.objects[id]!)).toBe(base + 3); // bench is 4 tiles from the footprint edge (x=5)
  });
});

describe('energy', () => {
  it('regenerates 1 per 3 minutes up to the cap and refills on level-up', () => {
    let s = createNewGame(T0, 5);
    s = { ...s, energy: 0, energyAt: T0 };
    expect(advance(s, T0 + 30 * MIN).energy).toBe(10);
    expect(advance(s, T0 + 10 * HOUR).energy).toBe(energyCap(1));
    s = { ...s, xp: levelXp(2) - 1 };
    const cot = findObj(s, 'cottage', (o) => (o.readyAt ?? 0) <= T0);
    const r = actE({ ...s, energy: 1 }, { t: 'collect', id: cot.id }, T0);
    expect(r.state.level).toBeGreaterThanOrEqual(2);
    expect(r.state.energy).toBeGreaterThanOrEqual(energyCap(2));
    expect(r.events.some((e) => e.type === 'levelUp')).toBe(true);
  });

  it('relaxed mode removes energy costs', () => {
    let s = createNewGame(T0, 5);
    s = act(s, { t: 'settings', relaxed: true }, T0);
    s = { ...s, energy: 0 };
    const cot = findObj(s, 'cottage', (o) => (o.readyAt ?? 0) <= T0);
    s = act(s, { t: 'collect', id: cot.id }, T0 + 1);
    expect(s.energy).toBeGreaterThanOrEqual(0);
  });

  it('refuses actions without energy', () => {
    const s = { ...createNewGame(T0, 5), energy: 0 };
    const cot = findObj(s, 'cottage', (o) => (o.readyAt ?? 0) <= T0);
    expect(tryAct(s, { t: 'collect', id: cot.id }, T0)).toMatchObject({ ok: false, error: 'noEnergy' });
  });
});

describe('offline progress', () => {
  it('after an hour away: crops grown, rent ready, energy restored', () => {
    let s = createNewGame(T0, 9);
    const plots = Object.values(s.objects).filter((o) => o.item === 'plot');
    for (const p of plots.filter((o) => o.crop)) s = act(s, { t: 'harvest', id: p.id }, T0);
    for (const p of plots) s = act(s, { t: 'plant', id: p.id, crop: 'strawberry' }, T0 + 1000);
    for (const c of Object.values(s.objects).filter((o) => o.item === 'cottage' && (o.readyAt ?? 0) <= T0 + 2000)) {
      s = act(s, { t: 'collect', id: c.id }, T0 + 2000);
    }
    s = { ...s, energy: 3 };
    const back = advance(s, T0 + HOUR);
    for (const p of plots) expect(cropStage(back, back.objects[p.id]!, T0 + HOUR)).not.toBe('seed');
    expect(Object.values(back.objects).filter((o) => o.item === 'cottage').every((o) => (o.readyAt ?? 0) <= T0 + HOUR)).toBe(true);
    expect(back.energy).toBe(energyCap(back.level));
  });

  it('shops sell piecewise while offline (fewer open shops sell faster)', () => {
    let s = createNewGame(T0, 9);
    s = { ...s, goods: 300 };
    s = act(s, { t: 'place', item: 'bakery', x: 3, y: 12, rot: 0 }, T0);
    const a = lastId(s);
    s = act(s, { t: 'place', item: 'bakery', x: 6, y: 12, rot: 0 }, T0);
    const b = lastId(s);
    for (const id of [a, b]) for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0 + 1000);
    s = act(s, { t: 'supply', id: a }, T0 + 2000);
    s = act(s, { t: 'supply', id: b }, T0 + 2000);
    const later = advance(s, T0 + 2000 + 4 * HOUR);
    expect(later.objects[a]!.shop!.state).toBe('soldout');
    expect(later.objects[b]!.shop!.state).toBe('soldout');
  });
});

describe('bonus bar', () => {
  it('maps pickups to the 10 stages', () => {
    expect(bonusStage(4)).toBe(0);
    expect(bonusStage(5)).toBe(1);
    expect(bonusStage(9)).toBe(2);
    expect(bonusStage(13)).toBe(3);
    expect(bonusStage(20)).toBe(5);
    expect(bonusStage(32)).toBe(10);
    expect(bonusStage(100)).toBe(10);
  });

  it('pays stage multiplier x level and cannot exceed earned pickups', () => {
    let s = { ...createNewGame(T0, 2), pickupBank: 9, level: 4 };
    expect(tryAct(s, { t: 'bonus', pickups: 13 }, T0)).toMatchObject({ ok: false });
    const coins = s.coins;
    s = act(s, { t: 'bonus', pickups: 9 }, T0);
    expect(s.coins).toBe(coins + Math.round(4.5 * 4));
    expect(s.pickupBank).toBe(0);
  });
});

describe('daily bonus', () => {
  it('builds a streak across consecutive days and resets after a gap', () => {
    let s = createNewGame(T0, 2);
    s = act(s, { t: 'claimDaily', tz: 0 }, T0);
    expect(s.daily.streak).toBe(1);
    expect(tryAct(s, { t: 'claimDaily', tz: 0 }, T0 + HOUR)).toMatchObject({ ok: false, error: 'alreadyDone' });
    s = act(s, { t: 'claimDaily', tz: 0 }, T0 + 24 * HOUR);
    expect(s.daily.streak).toBe(2);
    s = act(s, { t: 'claimDaily', tz: 0 }, T0 + 72 * HOUR);
    expect(s.daily.streak).toBe(1);
  });
});

describe('collections', () => {
  it('redeems a full set repeatedly', () => {
    let s = createNewGame(T0, 2);
    const set = content().collections.berries!;
    s = { ...s, collectibles: Object.fromEntries(set.items.map((i) => [i, 2])) };
    s = act(s, { t: 'redeem', collection: 'berries' }, T0);
    expect(s.collectionsDone.berries).toBe(1);
    s = act(s, { t: 'redeem', collection: 'berries' }, T0);
    expect(s.collectionsDone.berries).toBe(2);
    expect(tryAct(s, { t: 'redeem', collection: 'berries' }, T0)).toMatchObject({ ok: false, error: 'notReady' });
  });
});

describe('community buildings', () => {
  it('needs staff (volunteers) and a final click', () => {
    let s = createNewGame(T0, 4);
    s = act(s, { t: 'place', item: 'townhall', x: 21, y: 11, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0 + 1000);
    expect(tryAct(s, { t: 'build', id }, T0 + 2000)).toMatchObject({ ok: false, error: 'notReady' });
    for (let i = 0; i < 3; i++) s = act(s, { t: 'staff', id, source: 'vol' }, T0 + 3000);
    expect(s.volunteers).toBe(0);
    expect(tryAct(s, { t: 'staff', id, source: 'vol' }, T0 + 3000)).toMatchObject({ ok: false });
    s = act(s, { t: 'build', id }, T0 + 4000);
    expect(s.objects[id]!.built).toBe(true);
    expect(popCap(s)).toBe(150);
  });

  it('an NPC neighbor can fill only one slot per building', () => {
    let s = createNewGame(T0, 4);
    s = act(s, { t: 'place', item: 'townhall', x: 21, y: 11, rot: 0 }, T0);
    const id = lastId(s);
    for (let i = 0; i < 4; i++) s = act(s, { t: 'build', id }, T0 + 1000);
    s = act(s, { t: 'staff', id, source: 'npc:pip' }, T0 + 2000);
    expect(tryAct(s, { t: 'staff', id, source: 'npc:pip' }, T0 + 2000)).toMatchObject({ ok: false, error: 'alreadyDone' });
  });
});

describe('saves', () => {
  it('round-trips through the versioned save format', () => {
    const s = createNewGame(T0, 8);
    const back = readSave(JSON.parse(JSON.stringify(wrapSave(s, T0))), T0);
    expect(back).toEqual(s);
  });

  it('rejects garbage and newer versions, drops unknown items', () => {
    expect(() => readSave('nope', T0)).toThrow(SaveError);
    const s = createNewGame(T0, 8);
    expect(() => readSave({ ...s, v: 999 }, T0)).toThrow(SaveError);
    const bad = JSON.parse(JSON.stringify(s));
    bad.objects['9999'] = { id: 9999, item: 'spaceship', x: 1, y: 1, rot: 0, clicks: 0, built: true, placedAt: T0 };
    bad.coins = -50;
    const fixed = readSave(bad, T0);
    expect(fixed.objects['9999']).toBeUndefined();
    expect(fixed.coins).toBe(0);
  });
});
