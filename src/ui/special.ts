// Dialogs for the harbor, the railway, wonders, building parts and upgrades.
import { shipReady, trainReady } from '../sim/actions';
import { content, maybeItem } from '../sim/content';
import { upgradeMult } from '../sim/economy';
import type { ItemDef, WorldObject } from '../sim/types';
import { openDialog, type DialogHandle } from './dialog';
import { button, el, ico } from './dom';
import { rewardNodes, speech } from './goalsUi';
import { duration, fmt, itemName, t } from './i18n';
import type { Ctrl } from './types';

const partRow = (ctrl: Ctrl, parts: Record<string, number>, delivered?: Record<string, number>) =>
  el(
    'div',
    { class: 'rewards' },
    ...Object.entries(parts).map(([p, n]) => {
      const have = ctrl.state.parts[p] ?? 0;
      const done = delivered?.[p] ?? 0;
      const need = n - done;
      const ok = delivered ? need <= 0 : have >= n;
      return el(
        'span',
        { class: 'reward', title: t(`part.${p}`), style: ok ? 'background:#eaf7e2' : '' },
        ico(p),
        delivered ? `${t(`part.${p}`)} ${fmt(done)}/${fmt(n)}` : `${t(`part.${p}`)} ${fmt(have)}/${fmt(n)}`,
      );
    }),
  );

// ------------------------------------------------------------------- pier --

export function openPier(ctrl: Ctrl, id: number): void {
  let handle: DialogHandle;
  const render = (): Node[] => {
    const o = ctrl.state.objects[id];
    const def = o ? maybeItem(o.item) : undefined;
    if (!o || !def) return [];
    const now = ctrl.now();
    const rows: Node[] = [speech('marigold', t('pier.intro'))];
    (o.ships ?? []).forEach((sh, i) => {
      if (!sh) {
        const list = el('div', { class: 'seeds' });
        for (const c of content().contractList) {
          const locked = c.level !== undefined && ctrl.state.level < c.level;
          const goods = Math.round(c.goods * upgradeMult(o, def));
          const card = el(
            'button',
            { type: 'button', class: `seed${locked ? ' locked' : ''}`, 'aria-disabled': locked ? 'true' : 'false' },
            el('div', { class: 'nm', text: t(`contract.${c.id}`) }),
            el('div', { text: locked ? t('seed.locked', { level: c.level! }) : t('pier.cost', { coins: c.coins }) }),
            el('div', { text: t('pier.time', { time: duration(c.time) }) }),
            el('div', { text: t('seed.goods', { goods }) }),
            c.time >= 28800 ? el('div', { class: 'muted', text: t('pier.bonusPart') }) : null,
          );
          card.addEventListener('click', () => {
            if (locked) return ctrl.audio.play('error');
            if (ctrl.dispatch({ t: 'ship', id, slot: i, contract: c.id })) handle.setBody(render());
          });
          list.append(card);
        }
        rows.push(el('div', { class: 'section-title', text: t('pier.dock', { n: i + 1 }) }), list);
      } else if (shipReady(o, i, now)) {
        rows.push(
          el('div', { class: 'row' }, ico('shipReady'), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('pier.dock', { n: i + 1 }) }), el('div', { class: 't2', text: t('pier.back', { name: t(`contract.${sh.contract}`) }) })), button(el('span', null, ico('energy'), t('pier.unload')), () => {
            if (ctrl.dispatch({ t: 'unload', id, slot: i }, { objId: id })) handle.setBody(render());
          }, 'btn small honey')),
        );
      } else {
        const c = content().contracts[sh.contract];
        const left = c ? (sh.startedAt + c.time * 1000 - now) / 1000 : 0;
        rows.push(el('div', { class: 'row' }, ico('ship'), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('pier.dock', { n: i + 1 }) }), el('div', { class: 't2', text: t('pier.away', { name: t(`contract.${sh.contract}`), time: duration(left) }) }))));
      }
    });
    rows.push(...upgradeSection(ctrl, o, def, () => handle.setBody(render())));
    return rows;
  };
  handle = openDialog({ id: 'pier', title: itemName('pier'), icon: 'ship', body: render(), size: 'mid' });
}

// ------------------------------------------------------------------ train --

export function openTrain(ctrl: Ctrl, stops: { key: string; name: string; avatar: string }[]): void {
  let handle: DialogHandle;
  let tab: 'buy' | 'sell' = 'buy';
  const chosen = new Set(stops.slice(0, 5).map((s) => s.key));
  const render = (): Node[] => {
    const s = ctrl.state;
    const now = ctrl.now();
    const unlock = content().balance.train.unlockLevel;
    if (s.level < unlock) return [speech('marigold', t('train.locked', { level: unlock }))];
    if (s.train) {
      const r = content().routes[s.train.route];
      if (trainReady(s, now)) {
        return [
          speech('marigold', t('train.back')),
          el('div', { class: 'center' }, button(el('span', null, ico('energy'), t('train.collect')), () => {
            if (ctrl.dispatch({ t: 'trainCollect' })) handle.close();
          }, 'btn honey')),
        ];
      }
      const left = r ? (s.train.startedAt + r.time * 1000 - now) / 1000 : 0;
      return [speech('marigold', t('train.away', { time: duration(left) }))];
    }
    const out: Node[] = [speech('marigold', t('train.intro'))];
    const tabs = el('div', { class: 'grid2' });
    for (const k of ['buy', 'sell'] as const) {
      tabs.append(button(t(`train.${k}`), () => {
        tab = k;
        handle.setBody(render());
      }, `btn small ${tab === k ? 'honey' : 'plain'}`));
    }
    out.push(tabs);
    out.push(el('div', { class: 'section-title', text: t('train.stops') }));
    const stopRow = el('div', { class: 'rewards' });
    for (const st of stops) {
      const on = chosen.has(st.key);
      const b = button(el('span', null, ico(st.avatar), st.name), () => {
        if (on) chosen.delete(st.key);
        else chosen.add(st.key);
        handle.setBody(render());
      }, `reward${on ? '' : ' off'}`, { 'aria-pressed': on ? 'true' : 'false', style: on ? 'background:#eaf7e2' : 'opacity:.55' });
      stopRow.append(b);
    }
    out.push(stopRow, el('p', { class: 'muted center', text: t('train.stopsHint') }));
    const list = el('div', { class: 'seeds' });
    for (const r of content().routeList.filter((x) => x.type === tab)) {
      const locked = r.level !== undefined && s.level < r.level;
      const n = Math.min(r.stops, chosen.size);
      const ret = r.base + r.perStop * n;
      const card = el(
        'button',
        { type: 'button', class: `seed${locked ? ' locked' : ''}`, 'aria-disabled': locked ? 'true' : 'false' },
        el('div', { class: 'nm', text: t(`route.${r.id}`) }),
        el('div', { text: locked ? t('seed.locked', { level: r.level! }) : r.type === 'buy' ? t('train.pay', { coins: r.cost }) : t('train.ship', { goods: r.cost }) }),
        el('div', { text: r.type === 'buy' ? t('train.getGoods', { goods: ret }) : t('train.getCoins', { coins: ret }) }),
        el('div', { text: t('train.time', { time: duration(r.time) }) }),
        el('div', { class: 'muted', text: t('train.maxStops', { n: r.stops }) }),
      );
      card.addEventListener('click', () => {
        if (locked) return ctrl.audio.play('error');
        if (ctrl.dispatch({ t: 'train', route: r.id, stops: [...chosen].slice(0, r.stops) })) handle.close();
      });
      list.append(card);
    }
    out.push(list);
    return out;
  };
  handle = openDialog({ id: 'train', title: t('train.title'), icon: 'train', body: render(), size: 'mid' });
}

// ---------------------------------------------------------------- wonders --

export function openWonder(ctrl: Ctrl, id: number): void {
  let handle: DialogHandle;
  const render = (): Node[] => {
    const o = ctrl.state.objects[id];
    const def = o ? maybeItem(o.item) : undefined;
    if (!o || !def || !def.boost) return [];
    const b = content().boosts[def.boost]!;
    const now = ctrl.now();
    const left = Math.max(0, ((o.boostReadyAt ?? 0) - now) / 1000);
    const active = ctrl.state.boosts.find((x) => x.id === b.id && x.until > now);
    const rows: Node[] = [speech('hazel', t(`boost.${b.id}.desc`, { mins: Math.round(b.duration / 60) }))];
    if (active) rows.push(el('p', { class: 'center', text: t('wonder.active', { time: duration((active.until - now) / 1000) }) }));
    if (left <= 0) {
      rows.push(el('div', { class: 'center' }, button(el('span', null, ico('energy'), t('wonder.fire', { n: b.energy })), () => {
        if (ctrl.dispatch({ t: 'boost', id })) handle.close();
      }, 'btn honey')));
    } else {
      const keys = ctrl.state.parts.key ?? 0;
      rows.push(el('p', { class: 'center', text: t('wonder.recharge', { time: duration(left) }) }));
      rows.push(el('div', { class: 'center' }, button(el('span', null, ico('key'), t('wonder.useKeys', { n: b.keys, have: keys })), () => {
        if (ctrl.dispatch({ t: 'recharge', id })) handle.setBody(render());
      }, 'btn', keys < b.keys ? { disabled: true } : undefined)));
      rows.push(el('p', { class: 'muted center', text: t('wonder.keysHow') }));
    }
    return rows;
  };
  const o = ctrl.state.objects[id];
  handle = openDialog({ id: 'wonder', title: o ? itemName(o.item) : t('cat.special'), icon: 'wonder', body: render() });
}

// ------------------------------------------------------------------ parts --

export function openParts(ctrl: Ctrl, id: number): void {
  let handle: DialogHandle;
  const render = (): Node[] => {
    const o = ctrl.state.objects[id];
    const def = o ? maybeItem(o.item) : undefined;
    if (!o || !def || !def.parts) return [];
    const missing = Object.entries(def.parts).some(([p, n]) => (o.partsIn?.[p] ?? 0) < n);
    return [
      speech('hazel', t('parts.body', { name: itemName(def.id) })),
      el('div', { class: 'section-title', text: t('parts.delivered') }),
      partRow(ctrl, def.parts, o.partsIn ?? {}),
      el('div', { class: 'section-title', text: t('parts.yours') }),
      el('div', { class: 'rewards' }, ...rewardNodes({ parts: Object.fromEntries(Object.entries(ctrl.state.parts).filter(([k, n]) => n > 0 && k !== 'key')) })),
      el('p', { class: 'muted', text: t('parts.how') }),
      el('div', { class: 'center' }, button(t('parts.deliver'), () => {
        if (ctrl.dispatch({ t: 'deliverParts', id }, { objId: id })) handle.setBody(render());
      }, 'btn honey', missing ? undefined : { disabled: true })),
    ];
  };
  handle = openDialog({ id: 'parts', title: t('parts.title'), icon: 'toolkit', body: render() });
}

// --------------------------------------------------------------- upgrades --

export function upgradeSection(ctrl: Ctrl, o: WorldObject, def: ItemDef, rerender: () => void): Node[] {
  if (!def.upgrades?.length || !o.built) return [];
  const lvl = o.level ?? 1;
  const step = def.upgrades[lvl - 1];
  const out: Node[] = [el('div', { class: 'section-title', text: t('upgrade.title', { level: lvl, max: def.upgrades.length + 1 }) })];
  if (!step) {
    out.push(el('p', { class: 'center muted', text: t('upgrade.max') }));
    return out;
  }
  const lockedLevel = step.level !== undefined && ctrl.state.level < step.level;
  const okCoins = ctrl.state.coins >= step.coins;
  const okParts = Object.entries(step.parts ?? {}).every(([p, n]) => (ctrl.state.parts[p] ?? 0) >= n);
  let benefit: string;
  if (def.kind === 'business') benefit = t('upgrade.shop', { pct: Math.round((step.mult - 1) * 100) });
  else if (def.kind === 'pier') benefit = t('upgrade.pier', { n: def.slots?.[lvl] ?? lvl + 2 });
  else benefit = t('upgrade.cap', { pct: Math.round((step.mult - 1) * 100) });
  out.push(el('p', { text: benefit }));
  out.push(el('div', { class: 'rewards' }, el('span', { class: 'reward', style: okCoins ? '' : 'background:#ffe1dc' }, ico('coin'), fmt(step.coins))));
  if (step.parts) out.push(partRow(ctrl, step.parts));
  if (lockedLevel) out.push(el('p', { class: 'center muted', text: t('build.lockLevel', { level: step.level! }) }));
  out.push(
    el('div', { class: 'center' }, button(el('span', null, ico('upgrade'), t('upgrade.go', { level: lvl + 1 })), () => {
      if (ctrl.dispatch({ t: 'upgrade', id: o.id }, { objId: o.id })) {
        ctrl.audio.play('built');
        rerender();
      }
    }, 'btn honey', lockedLevel || !okCoins || !okParts ? { disabled: true } : undefined)),
  );
  return out;
}
