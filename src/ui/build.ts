// The Build menu: tabs of items with thumbnails, stats, prices and lock
// reasons. Prices are in coins only - nothing in Honeyhollow costs money.
import type { SpriteBank } from '../art/atlas';
import { unlockProblem } from '../sim/actions';
import { content } from '../sim/content';
import { population } from '../sim/economy';
import type { ItemDef } from '../sim/types';
import { openDialog, type DialogHandle } from './dialog';
import { el, ico } from './dom';
import { duration, fmt, itemName, t } from './i18n';
import type { Ctrl } from './types';

export const CATEGORIES = ['homes', 'shops', 'community', 'farming', 'decor', 'roads', 'harbor', 'special', 'events'];
const CAT_ICON: Record<string, string> = {
  homes: 'visit',
  shops: 'franchise',
  community: 'goals',
  farming: 'goods',
  decor: 'sparkle',
  roads: 'move',
  harbor: 'ship',
  special: 'wonder',
  events: 'event',
};

let thumbs = new Map<string, HTMLCanvasElement | null>();
let bankRef: SpriteBank | null = null;

export function setThumbBank(bank: SpriteBank): void {
  bankRef = bank;
  thumbs = new Map();
}

/** A small picture of an item (build menu, franchise picker). */
export function thumbFor(def: ItemDef): Node {
  if (!bankRef) return ico('build');
  const key = def.kind === 'road' ? 'road.10' : def.kind === 'sidewalk' ? 'sidewalk' : def.kind === 'plot' ? 'crop.strawberry.3' : bankRef.has(`item.${def.id}.0`) ? `item.${def.id}.0` : `item.${def.id}`;
  if (!thumbs.has(key)) thumbs.set(key, bankRef.thumb(key, 140, 96, new Map()));
  const c = thumbs.get(key);
  if (!c) return ico('build');
  // a copy so the same canvas can appear in several open menus
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.style.width = c.style.width;
  copy.getContext('2d')!.drawImage(c, 0, 0);
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}

function infoLines(def: ItemDef): string[] {
  const out: string[] = [];
  switch (def.kind) {
    case 'house':
      out.push(t('build.pop', { pop: def.pop ?? 0 }));
      out.push(t('build.rent', { coins: def.rent ?? 0, time: duration(def.rentTime ?? 0) }));
      break;
    case 'business':
      out.push(t('build.stock', { goods: def.goods ?? 0, coins: def.payout ?? 0 }));
      break;
    case 'hotel':
      out.push(t('build.tourists', { n: def.tourists ?? 0 }));
      if (def.profit) out.push(t('build.profit', { coins: def.profit, time: duration(def.profitTime ?? 0) }));
      break;
    case 'community':
    case 'landmark':
      if (def.cap) out.push(t('build.cap', { cap: def.cap }));
      if (def.jobs) out.push(t('build.jobs', { jobs: def.jobs }));
      break;
    case 'storage':
      out.push(t('build.storage', { goods: def.storage ?? 0 }));
      break;
    case 'decoration':
      out.push(t('build.bonus', { pct: def.bonus ?? 0 }));
      if (def.themeBonus && def.theme) out.push(t('build.themeBonus', { pct: def.themeBonus, theme: t(`theme.${def.theme}`) }));
      break;
    case 'plot':
      out.push(t('build.plot'));
      break;
    case 'road':
    case 'sidewalk':
      out.push(t('build.road'));
      break;
    default:
      if (def.cap) out.push(t('build.cap', { cap: def.cap }));
  }
  if (def.clicks) out.push(t('build.clicks', { n: def.clicks }));
  return out;
}

function lockText(ctrl: Ctrl, def: ItemDef): string | null {
  const p = unlockProblem(ctrl.state, def);
  if (!p) {
    if (def.limit) {
      let n = 0;
      for (const k in ctrl.state.objects) if (ctrl.state.objects[k]!.item === def.id) n++;
      if (n >= def.limit) return t('build.limit');
    }
    return null;
  }
  const u = def.unlock ?? {};
  if (u.level && ctrl.state.level < u.level) return t('build.lockLevel', { level: u.level });
  if (u.population && population(ctrl.state) < u.population) return t('build.lockPop', { pop: u.population });
  if (u.goal) return t('build.lockGoal');
  if (u.neighbors) return t('build.lockNeighbors', { n: u.neighbors });
  return t('err.locked');
}

let openHandle: DialogHandle | null = null;

export function openBuildMenu(ctrl: Ctrl, startCat?: string, highlight?: string): void {
  const items = content()
    .itemList.filter((d) => !d.hidden)
    .sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50));
  const cats = CATEGORIES.filter((c) => items.some((i) => i.category === c));
  let cat = startCat && cats.includes(startCat) ? startCat : cats[0]!;
  if (highlight) {
    const d = content().items[highlight];
    if (d && cats.includes(d.category)) cat = d.category;
  }
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const panel = el('div', { class: 'tabpanel body', role: 'tabpanel' });
  const render = () => {
    tabs.replaceChildren(
      ...cats.map((c) => {
        const b = el('button', { type: 'button', class: `tab${c === cat ? ' on' : ''}`, role: 'tab', 'aria-selected': c === cat ? 'true' : 'false', 'data-cat': c }, ico(CAT_ICON[c] ?? 'build'), t(`cat.${c}`));
        b.addEventListener('click', () => {
          cat = c;
          render();
          ctrl.audio.play('click');
        });
        return b;
      }),
    );
    const grid = el('div', { class: 'cards' });
    for (const def of items.filter((i) => i.category === cat)) {
      const lock = lockText(ctrl, def);
      const afford = ctrl.state.coins >= def.price;
      const card = el(
        'button',
        { type: 'button', class: `card${lock ? ' locked' : ''}${!lock && !afford ? ' cant' : ''}${def.id === highlight ? ' hint' : ''}`, 'aria-disabled': lock ? 'true' : 'false', 'data-item': def.id },
        el('div', { class: 'thumb' }, thumbFor(def)),
        el('div', { class: 'nm', text: itemName(def.id) }),
        el('div', { class: 'info', text: infoLines(def).join(' · ') }),
        lock ? el('div', { class: 'lockwhy', text: lock }) : el('div', { class: 'price' }, ico('coin'), def.price > 0 ? fmt(def.price) : t('build.free')),
        lock ? el('span', { class: 'lock' }, ico('lock')) : null,
      );
      card.setAttribute('aria-label', `${itemName(def.id)}. ${infoLines(def).join('. ')}. ${lock ?? `${fmt(def.price)} ${t('hud.coins')}`}`);
      card.addEventListener('click', () => {
        if (lock) {
          ctrl.audio.play('error');
          return;
        }
        if (!afford) {
          ctrl.audio.play('error');
          card.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 });
          return;
        }
        ctrl.audio.play('open');
        openHandle?.close();
        ctrl.startPlacing(def.id);
      });
      grid.append(card);
    }
    panel.replaceChildren(grid);
    const hinted = grid.querySelector('.card.hint');
    if (hinted) requestAnimationFrame(() => hinted.scrollIntoView({ block: 'nearest' }));
  };
  render();
  openHandle = openDialog({ id: 'build', title: t('build.title'), icon: 'build', body: [tabs, panel], size: 'wide', onClose: () => (openHandle = null) });
  openHandle.body.style.padding = '0';
}

export function isBuildOpen(): boolean {
  return openHandle !== null;
}
