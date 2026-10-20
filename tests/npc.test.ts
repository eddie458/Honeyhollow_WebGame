import { describe, expect, it } from 'vitest';
import { applyAction, bestHelp, buildNpcTown, content, createNewGame, rectOf, WorldIndex } from '../src/sim';
import { act, T0, tryAct } from './helpers';

describe('NPC neighbor towns', () => {
  it('build without overlaps and every building has road access', () => {
    for (const npc of content().npcs) {
      const skipped: string[] = [];
      const town = buildNpcTown(npc, '2026-10-19', T0, skipped);
      expect(skipped, `${npc.id} layout problems`).toEqual([]);
      const index = new WorldIndex(town);
      for (const o of Object.values(town.objects)) {
        const def = content().items[o.item]!;
        if (def.needsRoad) expect(index.roadAccess(rectOf(o)), `${npc.id}: ${o.item} at ${o.x},${o.y}`).toBe(true);
      }
    }
  });

  it('always offers several things to help with, varying by day', () => {
    for (const npc of content().npcs) {
      for (const day of ['2026-10-19', '2026-10-20', '2026-11-02']) {
        const town = buildNpcTown(npc, day, T0);
        const helpable = Object.values(town.objects).filter((o) => bestHelp(town, o, T0));
        expect(helpable.length, `${npc.id} ${day}`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('limits help to 5 actions per neighbor per day, once per object', () => {
    let s = createNewGame(T0, 3);
    const day = '2026-10-19';
    for (let i = 1; i <= 5; i++) s = act(s, { t: 'helpReward', reward: {}, npc: 'pip', objectId: i, day, key: `h:${i}` }, T0);
    expect(s.npc.pip!.helps).toBe(5);
    expect(tryAct(s, { t: 'helpReward', reward: {}, npc: 'pip', objectId: 9, day, key: 'h:9' }, T0)).toMatchObject({ ok: false, error: 'limit' });
    // a different neighbor still has 5
    s = act(s, { t: 'helpReward', reward: {}, npc: 'rosa', objectId: 1, day, key: 'r:1' }, T0);
    expect(tryAct(s, { t: 'helpReward', reward: {}, npc: 'rosa', objectId: 1, day, key: 'r:1b' }, T0)).toMatchObject({ ok: false, error: 'alreadyDone' });
    // next day resets
    const next = applyAction(s, { t: 'helpReward', reward: {}, npc: 'pip', objectId: 1, day: '2026-10-20', key: 'h:next' }, T0 + 86_400_000);
    expect(next.ok).toBe(true);
  });

  it('pays a visit bonus once per neighbor per day', () => {
    let s = createNewGame(T0, 3);
    const energy = s.energy;
    s = act(s, { t: 'visitBonus', npc: 'pip', day: '2026-10-19' }, T0);
    expect(s.energy).toBeGreaterThan(energy);
    expect(tryAct(s, { t: 'visitBonus', npc: 'pip', day: '2026-10-19' }, T0)).toMatchObject({ ok: false, error: 'alreadyDone' });
  });
});
