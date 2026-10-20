// Dialog windows: seed picker, staffing, shop info, collections, inventory,
// settings, daily bonus, level-up, energy, gifts, expansion and more.
import { DAY_NIGHT_MODES, type DayNightMode } from '../render/daylight';
import { volunteerNextIn } from '../sim/advance';
import { dailyNextDay, expansionCost, unlockProblem } from '../sim/actions';
import { content, maybeItem } from '../sim/content';
import { cropMasteryBonus, decoBonus, energyCap, masteryStars, population, shopGoods, shopPayout } from '../sim/economy';
import { achievementValue, activeEventIds } from '../sim/goals';
import { isCollectionComplete } from '../sim/rewards';
import type { Reward, WorldObject } from '../sim/types';
import { EVENT_IDS } from '../game/events';
import { confirmDialog, openDialog } from './dialog';
import { button, el, ico } from './dom';
import { rewardNodes, speech, npcName } from './goalsUi';
import { duration, fmt, has, itemName, t } from './i18n';
import { toast } from './overlay';
import { upgradeSection } from './special';
import type { Ctrl } from './types';

// ------------------------------------------------------------ seed picker --

export function openSeedPicker(ctrl: Ctrl, plotId: number): void {
  const s = ctrl.state;
  const grid = el('div', { class: 'seeds' });
  const handle = openDialog({ id: 'seeds', title: t('seed.title'), icon: 'goods', body: grid, size: 'mid' });
  for (const crop of content().cropList.slice().sort((a, b) => a.level - b.level || a.time - b.time)) {
    const locked = s.level < crop.level;
    const stars = masteryStars(s.mastery[crop.id] ?? 0, content().balance.crops.masteryThresholds);
    const bonus = cropMasteryBonus(s, crop.id);
    const goods = Math.round(crop.goods * (1 + bonus));
    const card = el(
      'button',
      { type: 'button', class: `seed${locked ? ' locked' : ''}`, 'aria-disabled': locked ? 'true' : 'false' },
      el('div', { class: 'nm', text: t(`crop.${crop.id}`) }),
      el('div', { text: locked ? t('seed.locked', { level: crop.level }) : t('seed.cost', { coins: crop.seed }) }),
      el('div', { text: t('seed.time', { time: duration(crop.time) }) }),
      el('div', { text: t('seed.goods', { goods }) }),
      el('div', { class: 'stars', title: t('seed.mastery') }, ...[0, 1, 2].map((i) => ico(i < stars ? 'star' : 'starEmpty'))),
    );
    card.addEventListener('click', () => {
      if (locked) return ctrl.audio.play('error');
      if (ctrl.dispatch({ t: 'plant', id: plotId, crop: crop.id }, { objId: plotId })) handle.close();
    });
    grid.append(card);
  }
}

// --------------------------------------------------------------- staffing --

export function openStaff(ctrl: Ctrl, id: number): void {
  const render = () => {
    const o = ctrl.state.objects[id];
    const def = o ? maybeItem(o.item) : undefined;
    if (!o || !def || !def.jobs) return [];
    const staff = o.staff ?? [];
    const slots = el('div', { class: 'slots' });
    for (let i = 0; i < def.jobs; i++) {
      const who = staff[i];
      slots.append(
        el(
          'div',
          { class: `slot${who ? ' full' : ''}` },
          ico(who ? (who === 'vol' ? 'volunteer' : who.startsWith('npc:') ? who.slice(4) : 'account') : 'hardhat'),
          el('div', { text: who ? (who === 'vol' ? t('staff.volunteer') : who.startsWith('npc:') ? npcName(who) : t('staff.filled', { who: '' })) : t('staff.empty') }),
        ),
      );
    }
    const full = staff.length >= def.jobs;
    const rows: Node[] = [el('p', { text: t('staff.body', { name: itemName(def.id), jobs: def.jobs }) }), slots];
    if (!full) {
      const next = volunteerNextIn(ctrl.state, ctrl.now());
      rows.push(el('p', { class: 'center muted', text: t('staff.volunteersLeft', { n: ctrl.state.volunteers, time: duration(next) }) }));
      const btns = el('div', { class: 'grid2' });
      btns.append(
        button(el('span', null, ico('volunteer'), t('staff.useVolunteer')), () => {
          if (ctrl.dispatch({ t: 'staff', id, source: 'vol' })) {
            ctrl.audio.play('pop');
            handle.setBody(render());
          }
        }, 'btn honey', ctrl.state.volunteers < 1 ? { disabled: true } : undefined),
      );
      for (const npc of content().npcs) {
        const used = ctrl.state.npc[npc.id]?.staffed.includes(id) ?? false;
        btns.append(
          button(el('span', null, ico(npc.avatar), t('staff.askNeighbor', { name: npcName(npc.id) })), () => {
            if (ctrl.dispatch({ t: 'staff', id, source: `npc:${npc.id}` })) {
              toast(t('staff.asked', { name: npcName(npc.id) }), 'good', npc.avatar);
              handle.setBody(render());
            }
          }, 'btn', used ? { disabled: true } : undefined),
        );
      }
      rows.push(btns);
      rows.push(el('div', { class: 'center', style: 'margin-top:8px' }, button(el('span', null, ico('friends'), t('staff.askFriends')), () => ctrl.requestJob(id, def.id), 'btn small plain')));
    } else {
      rows.push(
        el('div', { class: 'center' }, button(el('span', null, ico('energy'), t('staff.finish')), () => {
          if (ctrl.dispatch({ t: 'build', id }, { objId: id })) handle.close();
        }, 'btn honey')),
      );
    }
    return rows;
  };
  const handle = openDialog({ id: 'staff', title: t('staff.title'), icon: 'hardhat', body: render() });
}

// ------------------------------------------------------------- shop info --

export function openObjectInfo(ctrl: Ctrl, id: number): void {
  const o = ctrl.state.objects[id];
  const def = o ? maybeItem(o.item) : undefined;
  if (!o || !def) return;
  const body: Node[] = [];
  const now = ctrl.now();
  const lines: string[] = [];
  if (def.kind === 'business' && o.shop) {
    lines.push(t('tip.served', { served: Math.floor(o.shop.served), total: shopGoods(o, def) }));
    lines.push(t('tip.payout', { coins: shopPayout(ctrl.state, o, def, now) }));
    const stars = masteryStars(ctrl.state.mastery[def.id] ?? 0, content().balance.businessMastery.thresholds);
    lines.push(t('tip.mastery', { stars }));
  }
  if (def.kind === 'house') lines.push(t('tip.residents', { pop: def.pop ?? 0 }));
  if (def.kind === 'house' || def.kind === 'business') {
    const b = decoBonus(ctrl.state, o);
    if (b > 0) lines.push(t('tip.bonus', { pct: b }));
  }
  if (def.cap) lines.push(t('tip.capAdds', { cap: def.cap }));
  if (def.storage) lines.push(t('tip.storage', { goods: def.storage }));
  for (const l of lines) body.push(el('div', { class: 'row' }, el('div', { class: 'grow t1', text: l })));
  if (def.kind === 'business' && o.shop) {
    const input = el('input', { class: 'textin', maxlength: '24', placeholder: t('shop.namePlaceholder'), value: o.shop.name ?? '', 'aria-label': t('shop.rename') });
    body.push(el('div', { class: 'section-title', text: t('shop.rename') }), input);
    body.push(
      el('div', { class: 'center', style: 'margin-top:10px' }, button(t('shop.save'), () => {
        if (ctrl.dispatch({ t: 'nameShop', id, name: input.value })) toast(t('msg.shopNamed'), 'good');
      }, 'btn small')),
    );
  }
  const handle = openDialog({ id: 'info', title: o.shop?.name || itemName(def.id), icon: 'info', body: [...body, ...upgradeSection(ctrl, o, def, () => {
    handle.close();
    openObjectInfo(ctrl, id);
  })] });
}

// ----------------------------------------------------------- collections --

/** Long-term badges: three medals each, with progress towards the next one. */
export function openAchievements(ctrl: Ctrl): void {
  const s = ctrl.state;
  const rows = content().achievements.map((a) => {
    const tier = s.achievements[a.id] ?? 0;
    const value = achievementValue(s, a);
    const next = a.tiers[tier];
    const prev = tier > 0 ? a.tiers[tier - 1]! : 0;
    const pct = next === undefined ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    // medals carry their number too, so they never rely on colour alone
    const medals = el(
      'div',
      { class: 'medals', role: 'img', 'aria-label': t('ach.tiersEarned', { n: tier }) },
      ...a.tiers.map((_, i) => el('span', { class: `medal m${i + 1}${i < tier ? ' on' : ''}`, title: t(`ach.tier.${i + 1}`), text: String(i + 1) })),
    );
    const desc = `ach.${a.id}.desc`;
    const label = next === 1 && has(`${desc}.one`) ? t(`${desc}.one`) : t(desc, { n: fmt(next ?? 0) });
    const progress = next === undefined ? t('ach.done') : `${label} · ${fmt(Math.min(value, next))}/${fmt(next)}`;
    return el(
      'div',
      { class: 'row ach' },
      ico(a.icon),
      el('div', { class: 'grow' }, el('div', { class: 't1', text: t(`ach.${a.id}`) }), el('div', { class: 't2', text: progress }), el('div', { class: 'bar' }, el('i', { style: `width:${Math.round(pct * 100)}%` }))),
      medals,
    );
  });
  openDialog({ id: 'achievements', title: t('ach.title'), icon: 'trophy', body: rows, size: 'mid' });
}

export function openCollections(ctrl: Ctrl): void {
  const render = (): Node[] => {
    const s = ctrl.state;
    const out: Node[] = [];
    out.push(
      el(
        'div',
        { class: 'coll-top' },
        el('p', { class: 'muted', text: `${t('coll.wishlist')}: ${s.wishlist.map((w) => t(`c.${w}`)).join(', ') || '—'}` }),
        button(el('span', null, ico('trophy'), t('ach.title')), () => openAchievements(ctrl), 'btn small plain'),
      ),
    );
    const live = activeEventIds(ctrl.now());
    for (const c of content().collectionList) {
      // a seasonal collection shows while its event runs, or once you own a piece of it
      if (EVENT_IDS.includes(c.id) && !live.includes(c.id) && !c.items.some((k) => (s.collectibles[k] ?? 0) > 0)) continue;
      const items = el('div', { class: 'items' });
      for (const it of c.items) {
        const n = s.collectibles[it] ?? 0;
        const wished = s.wishlist.includes(it);
        const wish = button(ico('reputation'), () => {
          const list = wished ? s.wishlist.filter((w) => w !== it) : [...s.wishlist, it];
          if (!wished && s.wishlist.length >= 5) return toast(t('coll.wishFull'), 'bad');
          ctrl.dispatch({ t: 'wishlist', items: list }, { quiet: true });
          handle.setBody(render());
        }, `wish${wished ? ' on' : ''}`, { 'aria-label': wished ? t('coll.wishRemove') : t('coll.wishAdd'), title: wished ? t('coll.wishRemove') : t('coll.wishAdd'), 'aria-pressed': wished ? 'true' : 'false' });
        items.append(el('div', { class: `citem${n > 0 ? '' : ' missing'}`, title: n > 0 ? t(`c.${it}`) : t('coll.empty') }, wish, ico(it), el('span', { class: 'cnt', text: n > 0 ? `×${n}` : '' }), el('div', { text: t(`c.${it}`) })));
      }
      const ready = isCollectionComplete(s, c.id);
      const redeem = button(t('coll.redeem'), () => {
        if (ctrl.dispatch({ t: 'redeem', collection: c.id })) {
          ctrl.audio.play('collectible');
          handle.setBody(render());
        }
      }, 'btn small honey', ready ? undefined : { disabled: true });
      out.push(
        el(
          'section',
          { class: 'coll' },
          el('h3', null, el('span', { text: t(`coll.${c.id}`) }), el('span', { class: 'muted', text: s.collectionsDone[c.id] ? t('coll.redeemed', { n: s.collectionsDone[c.id]! }) : '' })),
          items,
          el('div', { class: 'foot' }, el('span', { class: 'muted', text: t('coll.dropsFrom', { where: t(`coll.where.${c.id}`) }) }), el('span', { class: 'rewards', style: 'margin:0' }, ...rewardNodes(c.reward)), redeem),
        ),
      );
    }
    return out;
  };
  const handle = openDialog({ id: 'collections', title: t('coll.title'), icon: 'collections', body: render(), size: 'wide' });
}

// -------------------------------------------------------------- inventory --

export function openInventory(ctrl: Ctrl): void {
  const s = ctrl.state;
  const rows: Node[] = [];
  const entries = Object.entries(s.inventory).filter(([, n]) => n > 0);
  if (entries.length === 0) rows.push(el('p', { class: 'muted', text: t('inv.empty') }));
  const handle = openDialog({ id: 'inventory', title: t('inv.title'), icon: 'inventory', body: rows, size: 'mid' });
  for (const [id, n] of entries) {
    const def = maybeItem(id);
    if (!def) continue;
    rows.push(
      el('div', { class: 'row' }, ico(def.kind === 'decoration' ? 'sparkle' : 'build'), el('div', { class: 'grow' }, el('div', { class: 't1', text: `${itemName(id)} ×${n}` })), button(t('inv.place'), () => {
        handle.close();
        ctrl.startPlacing(id, true);
      }, 'btn small honey')),
    );
  }
  const parts = Object.entries(s.parts).filter(([, n]) => n > 0);
  if (parts.length) {
    rows.push(el('div', { class: 'section-title', text: t('inv.parts') }));
    rows.push(el('div', { class: 'rewards' }, ...rewardNodes({ parts: Object.fromEntries(parts) })));
  }
  handle.setBody(rows);
}

// ----------------------------------------------------------------- daily --

export function openDaily(ctrl: Ctrl, tz: number): void {
  const s = ctrl.state;
  const now = ctrl.now();
  const table = content().balance.daily as Reward[];
  const avail = s.daily.day !== new Date(now - tz * 60000).toISOString().slice(0, 10);
  const today = dailyNextDay(s, now, tz);
  const days = el('div', { class: 'daily' });
  table.forEach((r, i) => {
    const n = i + 1;
    const cls = n < today || (!avail && n === today) ? 'past' : n === today ? 'today' : '';
    days.append(el('div', { class: `dday ${cls}` }, el('b', { text: n === today && avail ? t('daily.today') : t('daily.day', { n }) }), ...rewardNodes(r).map((x) => {
      x.style.display = 'inline-flex';
      x.style.margin = '2px';
      return x;
    })));
  });
  openDialog({
    id: 'daily',
    title: t('daily.title'),
    icon: 'daily',
    body: [el('p', { class: 'center', text: avail ? t('daily.body') : t('daily.claimed') }), days],
    size: 'mid',
    actions: avail
      ? [{ label: t('dlg.claim'), cls: 'honey', icon: 'gift', onClick: () => void ctrl.dispatch({ t: 'claimDaily', tz }) }]
      : [{ label: t('dlg.ok'), onClick: () => {} }],
  });
}

// --------------------------------------------------------------- level up --

export function openLevelUp(ctrl: Ctrl, from: number, level: number, reward: Reward, onClose: () => void): void {
  const inRange = (l: number | undefined) => l !== undefined && l >= from && l <= level;
  const unlocked = content().itemList.filter((d) => !d.hidden && inRange(d.unlock?.level));
  const crops = content().cropList.filter((c) => inRange(c.level));
  const body: Node[] = [el('p', { class: 'center', text: t('levelup.body', { cap: energyCap(level) }) }), el('div', { class: 'rewards' }, ...rewardNodes(reward))];
  if (unlocked.length || crops.length) {
    body.push(el('div', { class: 'section-title center', text: t('levelup.unlocks') }));
    body.push(el('p', { class: 'center', text: [...unlocked.map((d) => itemName(d.id)), ...crops.map((c) => t(`crop.${c.id}`))].join(' · ') }));
  }
  openDialog({ title: t('levelup.title', { level }), icon: 'level', body, actions: [{ label: t('dlg.continue'), onClick: () => {}, cls: 'honey' }], onClose });
  ctrl.audio.play('level');
}

// ----------------------------------------------------------- out of energy --

export function openNoEnergy(ctrl: Ctrl, nextIn: number): void {
  openDialog({
    id: 'energy',
    title: t('energy.title'),
    icon: 'energy',
    body: [speech('hazel', t('energy.body', { mins: Math.round(content().balance.energy.regenSeconds / 60), time: duration(nextIn) })), el('p', { class: 'muted', text: t('energy.tips') }), el('p', { class: 'muted', text: t('energy.relaxedNote') })],
    actions: [
      { label: t('energy.relaxed'), cls: 'plain', onClick: () => void ctrl.dispatch({ t: 'settings', relaxed: true }) },
      { label: t('dlg.ok'), onClick: () => {} },
    ],
  });
}

// --------------------------------------------------------------- settings --

export function openSettings(ctrl: Ctrl, version: string): void {
  const p = ctrl.prefs;
  const sw = (label: string, value: boolean, set: (v: boolean) => void) => {
    const id = `s-${Math.random().toString(36).slice(2, 7)}`;
    const input = el('input', { type: 'checkbox', class: 'switch', id, role: 'switch' });
    input.checked = value;
    input.addEventListener('change', () => set(input.checked));
    return el('div', { class: 'setting' }, el('label', { for: id, text: label }), input);
  };
  const vol = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(p.volume * 100)), 'aria-label': t('settings.volume') });
  vol.addEventListener('input', () => {
    p.volume = Number(vol.value) / 100;
    ctrl.applyPrefs();
    ctrl.savePrefs();
  });
  const name = el('input', { class: 'textin', maxlength: '28', value: ctrl.state.cityName, 'aria-label': t('settings.cityName') });
  const body: Node[] = [
    el('div', { class: 'section-title', text: t('settings.audio') }),
    sw(t('settings.sound'), p.sound, (v) => {
      p.sound = v;
      ctrl.applyPrefs();
      ctrl.savePrefs();
    }),
    sw(t('settings.music'), p.music, (v) => {
      p.music = v;
      ctrl.applyPrefs();
      ctrl.savePrefs();
    }),
    el('div', { class: 'setting' }, el('span', { text: t('settings.volume') }), vol),
    el('div', { class: 'section-title', text: t('settings.gameplay') }),
    sw(t('settings.relaxed'), ctrl.state.settings.relaxed, (v) => void ctrl.dispatch({ t: 'settings', relaxed: v }, { quiet: true })),
    sw(t('settings.noWither'), ctrl.state.settings.noWither, (v) => void ctrl.dispatch({ t: 'settings', noWither: v }, { quiet: true })),
    sw(t('settings.hints'), p.hints, (v) => {
      p.hints = v;
      ctrl.savePrefs();
      ctrl.showHint(null);
    }),
    el('div', { class: 'setting' }, el('label', { text: t('settings.cityName') }), el('div', { style: 'display:flex;gap:6px;flex:1.4' }, name, button(t('settings.save'), () => void ctrl.dispatch({ t: 'rename', name: name.value }), 'btn small'))),
    el('div', { class: 'section-title', text: t('settings.accessibility') }),
    sw(t('settings.reducedMotion'), p.reducedMotion, (v) => {
      p.reducedMotion = v;
      ctrl.applyPrefs();
      ctrl.savePrefs();
    }),
    sw(t('settings.colorblind'), p.colorblind, (v) => {
      p.colorblind = v;
      ctrl.applyPrefs();
      ctrl.savePrefs();
    }),
    el('p', { class: 'muted', text: t('settings.keys') }),
    el('div', { class: 'section-title', text: t('settings.display') }),
    sw(t('settings.quality'), p.highRes, (v) => {
      p.highRes = v;
      ctrl.applyPrefs();
      ctrl.savePrefs();
    }),
    el('p', { class: 'muted note', text: t('settings.qualityNote') }),
    (() => {
      const select = el('select', { class: 'textin', id: 's-daynight', 'aria-describedby': 's-daynight-note' });
      for (const m of DAY_NIGHT_MODES) {
        const opt = el('option', { value: m, text: t(`dayNight.${m}`) });
        if (m === p.dayNight) opt.selected = true;
        select.append(opt);
      }
      select.addEventListener('change', () => {
        p.dayNight = select.value as DayNightMode;
        ctrl.applyPrefs();
        ctrl.savePrefs();
      });
      return el('div', { class: 'setting' }, el('label', { for: 's-daynight', text: t('settings.dayNight') }), select);
    })(),
    el('p', { class: 'muted note', id: 's-daynight-note', text: t('settings.dayNightNote') }),
    el('div', { class: 'section-title', text: t('settings.data') }),
    el(
      'div',
      { class: 'grid2' },
      button(el('span', null, ico('store'), t('settings.export')), () => ctrl.exportSave(), 'btn plain'),
      button(el('span', null, ico('inventory'), t('settings.import')), () => ctrl.importSave(), 'btn plain'),
      button(el('span', null, ico('account'), t('tools.account')), () => ctrl.openAccount(), 'btn plain'),
      button(el('span', null, ico('cancel'), t('settings.reset')), () => confirmDialog(t('settings.reset'), t('settings.resetConfirm'), t('dlg.yes'), () => ctrl.resetGame(), true), 'btn red'),
    ),
    el('p', { class: 'center muted' }, el('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', text: t('settings.privacy') }), ` · ${t('settings.version', { v: version })} · ${t('app.free')}`),
  ];
  openDialog({ id: 'settings', title: t('settings.title'), icon: 'settings', body, size: 'mid' });
}

// -------------------------------------------------------------- expansion --

export function openExpand(ctrl: Ctrl, lx: number, ly: number): void {
  const cost = expansionCost(ctrl.state);
  const pop = population(ctrl.state);
  const okPop = pop >= cost.population;
  const okPermits = ctrl.state.permits >= cost.permits;
  const okCoins = ctrl.state.coins >= cost.coins;
  const row = (iconName: string, need: string, ok: boolean) => el('div', { class: 'row' }, ico(iconName), el('div', { class: 'grow t1', text: need }), ico(ok ? 'check' : 'cancel'));
  openDialog({
    id: 'expand',
    title: t('expand.title'),
    icon: 'expand',
    body: [
      speech('marigold', t('expand.body')),
      row('coin', t('expand.coins', { n: fmt(cost.coins) }), okCoins),
      row('population', t('expand.pop', { n: fmt(cost.population), have: fmt(pop) }), okPop),
      row('permit', t('expand.permits', { n: cost.permits, have: ctrl.state.permits }), okPermits),
      el('p', { class: 'muted', text: t('expand.permitsHow') }),
    ],
    actions: [
      { label: t('dlg.cancel'), cls: 'plain', onClick: () => {} },
      { label: t('expand.buy'), cls: 'honey', disabled: !(okPop && okPermits && okCoins), onClick: () => void ctrl.dispatch({ t: 'expand', lx, ly }) },
    ],
  });
}

// --------------------------------------------------------- gifts & helps --

export function openGifts(ctrl: Ctrl, onAcceptHelp: (id: string) => void): void {
  const render = (): Node[] => {
    const s = ctrl.state;
    const out: Node[] = [];
    if (s.gifts.length === 0 && s.helps.length === 0) out.push(el('p', { class: 'muted center', text: t('gifts.none') }));
    if (s.helps.length) {
      out.push(el('div', { class: 'section-title', text: t('gifts.helps') }));
      for (const h of s.helps) {
        const o = s.objects[h.objectId];
        out.push(
          el(
            'div',
            { class: 'row' },
            ico(ctrl.whoIcon(h.from)),
            el('div', { class: 'grow' }, el('div', { class: 't1', text: ctrl.whoName(h.from) }), el('div', { class: 't2', text: `${t(`help.${h.action}`)}${o ? ` · ${itemName(o.item)}` : ''}` })),
            button(t('dlg.accept'), () => {
              onAcceptHelp(h.id);
              handle.setBody(render());
            }, 'btn small honey'),
          ),
        );
      }
      if (s.helps.length > 1) {
        out.push(el('div', { class: 'center' }, button(t('gifts.acceptAll'), () => {
          for (const h of [...ctrl.state.helps]) onAcceptHelp(h.id);
          handle.setBody(render());
        }, 'btn')));
      }
    }
    if (s.gifts.length) {
      out.push(el('div', { class: 'section-title', text: t('gifts.gifts') }));
      for (const g of s.gifts) {
        // player gifts arrive with the sender's name already filled in
        const who = g.from.startsWith('npc:') || g.from.startsWith('user:') ? ctrl.whoName(g.from) : g.from;
        out.push(
          el('div', { class: 'row' }, ico(ctrl.whoIcon(g.from)), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('gifts.from', { who }) }), el('div', { class: 'rewards', style: 'justify-content:flex-start;margin:4px 0 0' }, ...rewardNodes(g.reward))), button(t('dlg.accept'), () => {
            if (ctrl.dispatch({ t: 'acceptGift', id: g.id })) {
              ctrl.audio.play('collectible');
              handle.setBody(render());
            }
          }, 'btn small honey')),
        );
      }
    }
    return out;
  };
  const handle = openDialog({ id: 'gifts', title: t('gifts.title'), icon: 'gift', body: render(), size: 'mid' });
}

// ---------------------------------------------------------------- intro --

export function openIntro(onStart: () => void): void {
  openDialog({
    title: t('intro.title'),
    icon: 'level',
    body: [speech('hazel', t('intro.body')), el('p', { class: 'center muted', text: t('intro.free') })],
    actions: [{ label: t('intro.start'), cls: 'honey', onClick: () => {} }],
    onClose: onStart,
    dismissable: false,
  });
}

export function openWelcomeBack(lines: string[]): void {
  if (lines.length === 0) return;
  openDialog({
    title: t('msg.welcomeBack'),
    icon: 'visit',
    body: el('ul', { class: 'tasks' }, ...lines.map((l) => el('li', null, ico('check'), el('span', { class: 't', text: l })))),
    actions: [{ label: t('dlg.ok'), onClick: () => {} }],
  });
}

export function unlockReason(ctrl: Ctrl, itemId: string): string | null {
  const def = maybeItem(itemId);
  if (!def) return null;
  return unlockProblem(ctrl.state, def);
}

export function describeObject(o: WorldObject): string {
  return itemName(o.item);
}
