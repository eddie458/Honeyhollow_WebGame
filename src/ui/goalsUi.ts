// Goals column, goal detail windows, completion popups and task texts.
import { content } from '../sim/content';
import { sortedActiveGoals, taskValue } from '../sim/goals';
import type { GameState, GoalDef, Reward, TaskDef } from '../sim/types';
import { openDialog } from './dialog';
import { button, el, ico } from './dom';
import { fmt, has, itemName, t } from './i18n';
import type { Ctrl } from './types';

export function npcName(id: string): string {
  const key = id.replace(/^npc:/, '');
  return has(`char.${key}`) ? t(`char.${key}`) : id;
}

export function taskText(task: TaskDef): string {
  const n = task.count;
  if (task.text) return t(task.text, { n });
  const key = task.key ?? '';
  switch (task.type) {
    case 'population':
      return t('task.population', { n });
    case 'popCap':
      return t('task.popCap', { n });
    case 'level':
      return t('task.level', { n });
    case 'have':
      return key.startsWith('kind:') ? t('task.haveKind', { n, kind: t(`kind.${key.slice(5)}`) }) : t('task.have', { n, item: itemName(key) });
    default:
      break;
  }
  if (has(`task.stat.${key}`)) return t(`task.stat.${key}`, { n });
  const [verb, a, b] = key.split(':');
  if (verb === 'built') return a === 'kind' ? t('task.statBuiltKind', { n, kind: t(`kind.${b}`) }) : t('task.statBuilt', { n, item: itemName(a!) });
  if (verb === 'place') return a === 'kind' ? t('task.statPlaceKind', { n, kind: t(`kind.${b}`) }) : t('task.statPlace', { n, item: itemName(a!) });
  if (verb === 'plant') return t('task.statPlant', { n, item: t(`crop.${a}`) });
  if (verb === 'harvest') return t('task.statHarvest', { n, item: t(`crop.${a}`) });
  if (verb === 'collect' && a === 'shop') return t('task.statCollectShop', { n, item: itemName(b!) });
  if (verb === 'redeem') return t('task.statRedeem', { n, item: t(`coll.${a}`) });
  if (verb === 'visit') return t('task.statVisit', { n, item: npcName(a!) });
  if (verb === 'help') return t('task.statHelp', { n, item: npcName(a!) });
  if (verb === 'upgrade') return `${t('task.stat.upgrade', { n })}: ${itemName(a!)}`;
  return `${key} ×${n}`;
}

const REWARD_ICONS: [keyof Reward, string][] = [
  ['coins', 'coin'],
  ['xp', 'xp'],
  ['energy', 'energy'],
  ['goods', 'goods'],
  ['volunteers', 'volunteer'],
  ['permits', 'permit'],
  ['reputation', 'reputation'],
];

export function rewardNodes(r: Reward): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const [k, iconName] of REWARD_ICONS) {
    const v = r[k];
    if (typeof v === 'number' && v > 0) out.push(el('span', { class: 'reward', title: t(`reward.${k}`, { n: v }) }, ico(iconName), fmt(v)));
  }
  for (const [p, n] of Object.entries(r.parts ?? {})) out.push(el('span', { class: 'reward', title: t(`part.${p}`) }, ico(p), `${n} ${t(`part.${p}`)}`));
  for (const [i, n] of Object.entries(r.items ?? {})) out.push(el('span', { class: 'reward' }, ico('gift'), `${n}× ${itemName(i)}`));
  for (const [c, n] of Object.entries(r.collectibles ?? {})) out.push(el('span', { class: 'reward' }, ico(c), `${n}× ${t(`c.${c}`)}`));
  return out;
}

export class GoalsColumn {
  private seen = new Set<string>();
  private lastSig = '';

  constructor(private ctrl: Ctrl, private host: HTMLElement) {}

  render(): void {
    const s = this.ctrl.state;
    const goals = sortedActiveGoals(s);
    const sig = goals.map((g) => `${g.id}:${this.progress(s, g.id).toFixed(2)}:${this.seen.has(g.id)}`).join('|');
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.host.replaceChildren();
    for (const g of goals.slice(0, 8)) {
      const def = content().goals[g.id];
      if (!def) continue;
      const pct = this.progress(s, g.id);
      const b = button(
        el('span', null, ico(def.char), el('span', { class: 'prog' }, el('span', { style: `display:block;height:100%;width:${Math.round(pct * 100)}%;background:var(--green)` }))),
        () => {
          this.seen.add(g.id);
          this.ctrl.openGoal(g.id);
          this.lastSig = '';
          this.render();
        },
        `goalbtn${this.seen.has(g.id) ? '' : ' new'}${def.tutorial ? ' tut' : ''}`,
        { 'aria-label': `${t(`goal.${g.id}.title`)} (${Math.round(pct * 100)}%)`, title: t(`goal.${g.id}.title`), 'data-goal': g.id },
      );
      this.host.append(b);
    }
  }

  markSeen(id: string): void {
    this.seen.add(id);
    this.lastSig = '';
  }

  private progress(s: GameState, id: string): number {
    const def = content().goals[id];
    const g = s.goals.active.find((x) => x.id === id);
    if (!def || !g) return 0;
    let sum = 0;
    for (const task of def.tasks) sum += Math.min(1, taskValue(s, g, task) / task.count);
    return sum / def.tasks.length;
  }
}

export function speech(charId: string, text: string): HTMLElement {
  return el(
    'div',
    { class: 'speech' },
    el('div', { class: 'portrait' }, ico(charId)),
    el('div', { class: 'bubble' }, el('div', { class: 'who', text: `${t(`char.${charId}`)} · ${t(`char.${charId}.role`)}` }), el('div', { text })),
  );
}

export function openGoalDialog(ctrl: Ctrl, id: string): void {
  const def: GoalDef | undefined = content().goals[id];
  const g = ctrl.state.goals.active.find((x) => x.id === id);
  if (!def || !g) return;
  const list = el('ul', { class: 'tasks' });
  let hint: string | undefined;
  for (const task of def.tasks) {
    const v = Math.min(task.count, taskValue(ctrl.state, g, task));
    const done = v >= task.count;
    if (!done && !hint) hint = task.hint;
    list.append(el('li', { class: done ? 'done' : '' }, ico(done ? 'check' : 'goals'), el('span', { class: 't', text: taskText(task) }), el('span', { class: 'n', text: t('goal.progress', { cur: fmt(v), max: fmt(task.count) }) })));
  }
  const actions = [{ label: t('dlg.ok'), onClick: () => {}, cls: 'plain' }];
  if (hint) actions.push({ label: t('goal.show'), onClick: () => ctrl.showHint(hint!), cls: 'honey' });
  openDialog({
    id: 'goal',
    title: t(`goal.${id}.title`),
    icon: 'goals',
    body: [speech(def.char, t(`goal.${id}.text`)), list, el('div', { class: 'center muted', text: t('goal.rewards') }), el('div', { class: 'rewards' }, ...rewardNodes(def.reward))],
    actions,
  });
}

export function openGoalComplete(ids: string[], onClose: () => void): void {
  const defs = ids.map((id) => content().goals[id]).filter((d): d is GoalDef => d !== undefined);
  const first = defs[0];
  if (!first) return onClose();
  const body: Node[] =
    defs.length === 1
      ? [
          el('h3', { class: 'center', text: t(`goal.${first.id}.title`), style: 'margin:0 0 8px' }),
          speech(first.char, has(`goal.${first.id}.done`) ? t(`goal.${first.id}.done`) : t(`char.${first.char}.cheer`)),
          el('div', { class: 'rewards' }, ...rewardNodes(first.reward)),
        ]
      : [
          speech(first.char, t(`char.${first.char}.cheer`)),
          ...defs.map((d) =>
            el('div', { class: 'row' }, ico(d.char), el('div', { class: 'grow' }, el('div', { class: 't1', text: t(`goal.${d.id}.title`) }), el('div', { class: 'rewards', style: 'justify-content:flex-start;margin:4px 0 0' }, ...rewardNodes(d.reward)))),
          ),
        ];
  openDialog({
    title: defs.length === 1 ? t('goal.complete') : t('goal.completeMany', { n: defs.length }),
    icon: 'check',
    body,
    actions: [{ label: t('dlg.collect'), onClick: () => {}, cls: 'honey' }],
    onClose,
  });
}
