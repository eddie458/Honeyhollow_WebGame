import { describe, expect, it } from 'vitest';
import { content, createNewGame } from '../src/sim';
import { actE, T0 } from './helpers';

describe('achievements', () => {
  it('award each medal once, with its reward', () => {
    let s = createNewGame(T0, 3);
    s = { ...s, stats: { ...s.stats, harvest: 24 } };
    const coins = s.coins;
    let r = actE(s, { t: 'flag', key: 'a' }, T0);
    expect(r.state.achievements.greenthumb ?? 0).toBe(0);
    s = { ...r.state, stats: { ...r.state.stats, harvest: 25 } };
    r = actE(s, { t: 'flag', key: 'b' }, T0);
    expect(r.state.achievements.greenthumb).toBe(1);
    expect(r.events).toContainEqual({ type: 'achievement', id: 'greenthumb', tier: 1 });
    // (the medal's XP can also level the player up, which pays more on top)
    expect(r.state.coins).toBeGreaterThanOrEqual(coins + content().achievementRewards[0]!.coins!);
    r = actE(r.state, { t: 'flag', key: 'c' }, T0);
    expect(r.events.some((e) => e.type === 'achievement')).toBe(false);
  });

  it('catch up older saves with every medal they already earned', () => {
    const s = createNewGame(T0, 4);
    const r = actE({ ...s, stats: { ...s.stats, 'collect:rent': 300 } }, { t: 'flag', key: 'x' }, T0);
    expect(r.state.achievements.landlord).toBe(2);
    expect(r.events.filter((e) => e.type === 'achievement')).toHaveLength(2);
  });
});
