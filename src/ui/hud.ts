// Heads-up display: resources across the top, goals down the left, neighbors
// along the bottom, build button and tools bottom-right, bonus bar top-right.
import { energyNextIn } from '../sim/advance';
import { content } from '../sim/content';
import { energyCap, goodsCap, levelXp, maxLevel, mood, popCap, population } from '../sim/economy';
import { dailyAvailable } from '../sim/actions';
import { BonusBar } from './bonusbar';
import { button, el, ico } from './dom';
import { duration, fmt, shortNum, t } from './i18n';
import type { Ctrl, Tool } from './types';

export type Pending = Record<'coins' | 'xp' | 'energy' | 'goods', number>;

export class Hud {
  readonly root: HTMLElement;
  readonly goals: HTMLElement;
  readonly neighbors: HTMLElement;
  readonly bonus: BonusBar;
  private coins: HTMLElement;
  private energy: HTMLElement;
  private energySub: HTMLElement;
  private goodsV: HTMLElement;
  private lvlNum: HTMLElement;
  private xpFill: HTMLElement;
  private xpPill: HTMLElement;
  private vol: HTMLElement;
  private permits: HTMLElement;
  private popFace: HTMLElement;
  private popCity: HTMLElement;
  private popVal: HTMLElement;
  private popBox: HTMLElement;
  private dailyBadge: HTMLElement;
  private giftBadge: HTMLElement;
  private modebar: HTMLElement;
  private modeText: HTMLElement;
  private modeRotate: HTMLButtonElement;
  private toolBtns: Record<Tool, HTMLButtonElement>;
  private pills: Record<string, HTMLElement> = {};
  private normalParts: HTMLElement[] = [];
  readonly visitBar: HTMLElement;
  readonly visitBanner: HTMLElement;
  private lastMood = '';
  private lastNeighborsSig = '';

  constructor(private ctrl: Ctrl, bonus: BonusBar) {
    this.bonus = bonus;
    const pill = (kind: string, iconName: string, label: string, small = false) => {
      const v = el('span', { class: 'val' });
      const node = el('div', { class: `pill ${kind}${small ? ' small' : ''}`, 'data-hud': kind, role: 'group', 'aria-label': label, tabindex: '0' }, ico(iconName), v);
      this.pills[kind] = node;
      return { node, v };
    };
    const c = pill('coins', 'coin', t('hud.coins'));
    this.coins = c.v;
    const e = pill('energy', 'energy', t('hud.energy'));
    this.energy = e.v;
    this.energySub = el('span', { class: 'sub' });
    e.node.append(this.energySub);
    const g = pill('goods', 'goods', t('hud.goods'));
    this.goodsV = g.v;
    this.lvlNum = el('b');
    this.xpFill = el('div');
    this.xpPill = el('div', { class: 'pill levelpill', 'data-hud': 'xp', role: 'group', 'aria-label': t('hud.xp'), tabindex: '0' }, el('span', { class: 'lvlstar' }, ico('level'), this.lvlNum), el('div', { class: 'xpbar' }, this.xpFill));
    this.pills.xp = this.xpPill;
    const v = pill('volunteers', 'volunteer', t('hud.volunteers'), true);
    this.vol = v.v;
    const p = pill('permits', 'permit', t('hud.permits'), true);
    this.permits = p.v;
    const topbar = el('div', { class: 'topbar' }, c.node, e.node, g.node, this.xpPill, v.node, p.node);

    this.dailyBadge = el('span', { class: 'badge dot hidden' });
    this.giftBadge = el('span', { class: 'badge hidden' });
    const rbtn = (name: string, label: string, fn: () => void, badge?: HTMLElement) => {
      const b = button(ico(name), fn, 'roundbtn', { 'aria-label': label, title: label });
      if (badge) b.append(badge);
      return b;
    };
    const iconrow = el(
      'div',
      { class: 'iconrow' },
      rbtn('settings', t('tools.settings'), () => ctrl.openSettings()),
      rbtn('daily', t('tools.daily'), () => ctrl.openDaily(), this.dailyBadge),
      rbtn('gift', t('tools.gifts'), () => ctrl.openGifts(), this.giftBadge),
      rbtn('expand', t('tools.expand'), () => ctrl.startExpand()),
      (() => {
        const b = rbtn('friends', t('tools.neighbors'), () => this.neighbors.classList.toggle('open'));
        b.classList.add('mobile-only');
        return b;
      })(),
      rbtn('zoomIn', t('tools.zoomIn'), () => ctrl.zoom(1.2)),
      rbtn('zoomOut', t('tools.zoomOut'), () => ctrl.zoom(1 / 1.2)),
    );
    const topright = el('div', { class: 'topright' }, bonus.node, iconrow);

    this.goals = el('nav', { class: 'goals', 'aria-label': t('tools.goals') });
    this.popFace = el('span');
    this.popCity = el('div', { class: 'city' });
    this.popVal = el('div', { class: 'pop' });
    this.popBox = el('div', { class: 'popbox interactive', role: 'group', tabindex: '0', 'aria-label': t('hud.population') }, this.popFace, el('div', null, this.popCity, this.popVal));
    this.neighbors = el('nav', { class: 'neighbors', 'aria-label': t('tools.neighbors') });

    const tool = (name: Tool, iconName: string) => {
      const b = button(ico(iconName), () => ctrl.setTool(name), 'toolbtn', { 'aria-label': t(`tools.${name}`), title: `${t(`tools.${name}`)}${name === 'move' ? ' (M)' : name === 'rotate' ? ' (R)' : ''}` });
      return b;
    };
    this.toolBtns = { move: tool('move', 'move'), rotate: tool('rotate', 'rotate'), store: tool('store', 'store'), sell: tool('sell', 'sell') };
    const build = button(el('span', null, ico('build'), el('span', { text: t('tools.build') })), () => ctrl.openBuild(), 'buildbtn', { 'aria-label': `${t('tools.build')} (B)`, 'data-hud': 'build' });
    const tools = el(
      'div',
      { class: 'tools' },
      this.toolBtns.move,
      this.toolBtns.rotate,
      this.toolBtns.store,
      this.toolBtns.sell,
      button(ico('collections'), () => ctrl.openCollections(), 'toolbtn', { 'aria-label': t('tools.collections'), title: t('tools.collections'), 'data-hud': 'collections' }),
      button(ico('inventory'), () => ctrl.openInventory(), 'toolbtn', { 'aria-label': t('tools.inventory'), title: t('tools.inventory'), 'data-hud': 'inventory' }),
      build,
    );

    this.modeText = el('span');
    this.modeRotate = button(el('span', null, ico('rotate'), t('tools.rotate')), () => ctrl.rotateGhost(), 'btn small honey');
    const modeDone = button(t('tools.done'), () => ctrl.cancelMode(), 'btn small');
    this.modebar = el('div', { class: 'modebar hidden', role: 'status' }, this.modeText, this.modeRotate, modeDone);

    this.visitBar = el('div', { class: 'visitbar hidden', 'aria-label': 'help actions' });
    this.visitBanner = el('div', { class: 'visitbanner hidden' });

    this.normalParts = [this.goals, this.popBox, tools, iconrow, this.neighbors];
    this.root = el('div', { id: 'hud' }, topbar, topright, this.goals, this.popBox, this.neighbors, tools, this.modebar, this.visitBar, this.visitBanner);
  }

  target(kind: string): Element | null {
    if (kind === 'coins' || kind === 'energy' || kind === 'goods' || kind === 'xp' || kind === 'volunteers' || kind === 'permits') return this.pills[kind] ?? null;
    if (kind === 'reputation') return this.pills.xp ?? null;
    if (kind === 'collectible' || kind === 'part') return this.root.querySelector('[data-hud="collections"]');
    if (kind === 'volunteer') return this.pills.volunteers ?? null;
    if (kind === 'permit') return this.pills.permits ?? null;
    if (kind === 'build') return this.root.querySelector('[data-hud="build"]');
    if (kind === 'inventory') return this.root.querySelector('[data-hud="inventory"]');
    return this.pills.coins ?? null;
  }

  update(pending: Pending, tz: number): void {
    const s = this.ctrl.state;
    const now = this.ctrl.now();
    const coins = Math.max(0, s.coins - pending.coins);
    this.coins.textContent = coins >= 1e6 ? shortNum(coins) : fmt(coins);
    const cap = energyCap(s.level);
    const en = Math.max(0, s.energy - pending.energy);
    if (s.settings.relaxed) {
      this.energy.textContent = '∞';
      this.energySub.textContent = '';
      this.pills.energy!.title = t('hud.relaxed');
    } else {
      this.energy.textContent = `${fmt(en)}/${cap}`;
      const next = energyNextIn(s, now);
      this.energySub.textContent = en >= cap ? '' : duration(next);
      this.pills.energy!.title = `${t('hud.energyTip', { cur: en, cap, mins: Math.round(content().balance.energy.regenSeconds / 60) })} ${en > cap ? t('hud.energyOver') : en >= cap ? t('hud.energyFull') : t('hud.energyNext', { time: duration(next) })}`;
    }
    this.pills.energy!.classList.toggle('over', en > cap && !s.settings.relaxed);
    const gcap = goodsCap(s);
    const goods = Math.max(0, s.goods - pending.goods);
    this.goodsV.textContent = `${fmt(goods)}/${fmt(gcap)}`;
    this.pills.goods!.title = t('hud.goodsTip', { cur: goods, cap: gcap });
    this.lvlNum.textContent = String(s.level);
    const xp = Math.max(0, s.xp - pending.xp);
    const lo = levelXp(s.level);
    const hi = levelXp(s.level + 1);
    const frac = s.level >= maxLevel() ? 1 : Math.max(0, Math.min(1, (xp - lo) / Math.max(1, hi - lo)));
    this.xpFill.style.width = `${Math.round(frac * 100)}%`;
    this.xpPill.title = s.level >= maxLevel() ? t('hud.levelMax') : t('hud.levelTip', { xp: fmt(xp), next: fmt(hi), nextLevel: s.level + 1 });
    this.xpPill.setAttribute('aria-label', `${t('hud.level', { level: s.level })}. ${this.xpPill.title}`);
    this.vol.textContent = fmt(s.volunteers);
    this.pills.volunteers!.title = t('hud.volunteersTip', { n: s.volunteers, max: content().balance.volunteers.max });
    this.permits.textContent = fmt(s.permits);
    this.pills.permits!.title = t('hud.permits');
    const pop = population(s);
    const pcap = popCap(s);
    const m = mood(s);
    if (m !== this.lastMood) {
      this.popFace.replaceChildren(ico(m));
      this.lastMood = m;
    }
    this.popCity.textContent = s.cityName;
    this.popVal.textContent = `${fmt(pop)} / ${fmt(pcap)}`;
    this.popBox.title = t('hud.popTip', { pop, cap: pcap, mood: t(`mood.${m}`) });
    this.dailyBadge.classList.toggle('hidden', !dailyAvailable(s, now, tz));
    const gifts = s.gifts.length + s.helps.length;
    this.giftBadge.textContent = String(gifts);
    this.giftBadge.classList.toggle('hidden', gifts === 0);
  }

  renderNeighbors(): void {
    const list = this.ctrl.neighbors();
    const sig = JSON.stringify(list);
    if (sig === this.lastNeighborsSig) return;
    this.lastNeighborsSig = sig;
    this.neighbors.replaceChildren();
    for (const n of list) {
      const bolts = el('span', { class: 'bolts' });
      if (n.helpsLeft > 0) bolts.append(el('span', { class: 'badge', text: String(n.helpsLeft), title: `${n.helpsLeft} help actions left today` }));
      const card = button(
        el('span', null, el('span', { class: 'face' }, ico(n.avatar), el('span', { class: 'lvl', text: String(n.level) })), el('span', { class: 'nm', text: n.name }), bolts),
        () => this.ctrl.visit(n.key),
        'nb',
        { 'aria-label': `${t('tools.neighbors')}: ${n.name} (${n.town})`, title: `${n.name} - ${n.town}` },
      );
      this.neighbors.append(card);
    }
    const add = button(el('span', null, el('span', { class: 'face', text: '+' }), el('span', { class: 'nm', text: t('tools.neighbors') })), () => this.ctrl.openNeighbors(), 'nb add', { 'aria-label': t('tools.neighbors') });
    this.neighbors.append(add);
  }

  setMode(text: string | null, rotate: boolean, activeTool: Tool | null): void {
    this.modebar.classList.toggle('hidden', text === null);
    this.modeText.textContent = text ?? '';
    this.modeRotate.classList.toggle('hidden', !rotate);
    for (const [k, b] of Object.entries(this.toolBtns)) b.classList.toggle('active', k === activeTool);
  }

  setVisiting(on: boolean): void {
    for (const p of this.normalParts) p.classList.toggle('hidden', on);
    this.visitBar.classList.toggle('hidden', !on);
    this.visitBanner.classList.toggle('hidden', !on);
  }
}
