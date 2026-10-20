// Goal chains: activation, progress and completion.
import { content, maybeItem } from './content';
import { popCap, population } from './economy';
import { applyReward, bump, type Ctx } from './rewards';
import { isEventActive } from './season';
import type { GameState, GoalDef, GoalProgress, TaskDef } from './types';

export { activeEventIds, isEventActive, setEventResolver } from './season';

export function haveCount(s: GameState, key: string): number {
  let n = 0;
  const kind = key.startsWith('kind:') ? key.slice(5) : null;
  for (const k in s.objects) {
    const o = s.objects[k]!;
    if (!o.built) continue;
    if (kind) {
      if (maybeItem(o.item)?.kind === kind) n++;
    } else if (o.item === key) n++;
  }
  return n;
}

export function taskValue(s: GameState, g: GoalProgress, t: TaskDef): number {
  switch (t.type) {
    case 'stat':
      return (s.stats[t.key ?? ''] ?? 0) - (g.base[t.key ?? ''] ?? 0);
    case 'have':
      return haveCount(s, t.key ?? '');
    case 'population':
      return population(s);
    case 'level':
      return s.level;
    case 'popCap':
      return popCap(s);
    default:
      return 0;
  }
}

export function taskDone(s: GameState, g: GoalProgress, t: TaskDef): boolean {
  return taskValue(s, g, t) >= t.count;
}

export function goalDone(s: GameState, g: GoalProgress): boolean {
  const def = content().goals[g.id];
  if (!def) return false;
  return def.tasks.every((t) => taskDone(s, g, t));
}

function eligible(s: GameState, def: GoalDef, now: number): boolean {
  if (s.goals.done.includes(def.id)) return false;
  if (s.goals.active.some((g) => g.id === def.id)) return false;
  if (def.level && s.level < def.level) return false;
  if (!isEventActive(def.event, now)) return false;
  return (def.requires ?? []).every((r) => s.goals.done.includes(r));
}

/** Activates every goal whose prerequisites are met. */
export function refreshGoals(ctx: Ctx): void {
  const { s, now } = ctx;
  // Drop event goals whose event has ended.
  s.goals.active = s.goals.active.filter((g) => {
    const def = content().goals[g.id];
    return def !== undefined && isEventActive(def.event, now);
  });
  for (const def of content().goalList) {
    if (!eligible(s, def, now)) continue;
    const base: Record<string, number> = {};
    for (const t of def.tasks) if (t.type === 'stat' && t.key) base[t.key] = s.stats[t.key] ?? 0;
    s.goals.active.push({ id: def.id, startedAt: now, base });
    ctx.events.push({ type: 'goalNew', id: def.id });
  }
}

/** Completes satisfied goals (granting rewards) and unlocks follow-ups, repeatedly. */
export function checkGoals(ctx: Ctx): void {
  const s = ctx.s;
  for (let pass = 0; pass < 20; pass++) {
    refreshGoals(ctx);
    const finished = s.goals.active.filter((g) => goalDone(s, g));
    if (finished.length === 0) return;
    for (const g of finished) {
      s.goals.active = s.goals.active.filter((x) => x.id !== g.id);
      s.goals.done.push(g.id);
      bump(s, 'goal');
      const def = content().goals[g.id]!;
      applyReward(ctx, def.reward, false);
      ctx.events.push({ type: 'goalDone', id: g.id });
    }
  }
}

/** Value an achievement measures right now. */
export function achievementValue(s: GameState, a: { stat?: string; type?: string }): number {
  if (a.type === 'population') return population(s);
  return a.stat ? s.stats[a.stat] ?? 0 : 0;
}

/** Awards every achievement tier whose mark has been passed (several at once for older saves). */
export function checkAchievements(ctx: Ctx): void {
  const s = ctx.s;
  const rewards = content().achievementRewards;
  for (const a of content().achievements) {
    let tier = s.achievements[a.id] ?? 0;
    const value = achievementValue(s, a);
    while (tier < a.tiers.length && value >= a.tiers[tier]!) {
      tier++;
      s.achievements[a.id] = tier;
      const r = rewards[tier - 1];
      if (r) applyReward(ctx, r, false);
      ctx.events.push({ type: 'achievement', id: a.id, tier });
    }
  }
}

export function sortedActiveGoals(s: GameState): GoalProgress[] {
  const goals = content().goals;
  return s.goals.active.slice().sort((a, b) => (goals[a.id]?.order ?? 0) - (goals[b.id]?.order ?? 0));
}
