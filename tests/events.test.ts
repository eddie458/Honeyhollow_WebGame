import { describe, expect, it } from 'vitest';
import { activeEvents, setupEvents } from '../src/game/events';
import { content, createNewGame } from '../src/sim';
import { makeCtx, payout } from '../src/sim/rewards';
import { act } from './helpers';

const OCT19 = new Date(2026, 9, 19, 12).getTime();

describe('seasonal events', () => {
  it('run on their dates, including a season across New Year', () => {
    expect(activeEvents(OCT19).map((e) => e.id)).toEqual(['harvestfest']);
    expect(activeEvents(new Date(2026, 11, 24, 12).getTime()).map((e) => e.id)).toEqual(['winterlights']);
    expect(activeEvents(new Date(2027, 0, 5, 12).getTime()).map((e) => e.id)).toEqual(['winterlights']);
    expect(activeEvents(new Date(2026, 6, 1, 12).getTime())).toEqual([]);
  });

  it('offer their items and goals only while they run', () => {
    setupEvents(OCT19);
    expect(content().items.pumpkinstack?.hidden).toBe(false);
    expect(content().items.snowman?.hidden).toBe(true);
    let s = { ...createNewGame(OCT19, 5), level: 3 };
    s = act(s, { t: 'flag', key: 'poke' }, OCT19);
    expect(s.goals.active.map((g) => g.id)).toContain('hf_harvest');
    // after the festival the goal is dropped
    const later = new Date(2026, 11, 2, 12).getTime();
    s = act(s, { t: 'flag', key: 'poke2' }, later);
    expect(s.goals.active.map((g) => g.id)).not.toContain('hf_harvest');
  });

  it('turn about half the finds into festival finds', () => {
    setupEvents(OCT19);
    const ctx = makeCtx(createNewGame(OCT19, 9), OCT19);
    for (let i = 0; i < 4000; i++) payout(ctx, 'harvest', {}, { x: 0, y: 0 }, { collection: 'berries' });
    const got = ctx.s.collectibles;
    const count = (ids: string[]) => ids.reduce((n, id) => n + (got[id] ?? 0), 0);
    const festival = count(content().collections.harvestfest!.items);
    const berries = count(content().collections.berries!.items);
    expect(festival).toBeGreaterThan(0);
    expect(berries).toBeGreaterThan(0);
    expect(festival / (festival + berries)).toBeGreaterThan(0.3);
    expect(festival / (festival + berries)).toBeLessThan(0.7);
  });
});
