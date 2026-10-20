// Franchises (online): open a copy of one of your shops on a neighbor's Empty
// Lot, make one supply run a day to all of them, and host neighbors'
// franchises on your own lots (accept requests, take the goods they deliver).
// The server keeps the franchise records; this module mirrors them.
import { api } from '../net/api';
import { franchiseCost, maybeItem, type Reward } from '../sim';
import { thumbFor } from '../ui/build';
import { confirmDialog, openDialog, type DialogHandle } from '../ui/dialog';
import { button, el, ico } from '../ui/dom';
import { fmt, itemName, t } from '../ui/i18n';
import { toast } from '../ui/overlay';
import type { Controller } from './controller';

type Status = 'pending' | 'active' | 'declined';

interface Base {
  id: number;
  item: string;
  lotId: number;
  stars: number;
  deliveries: number;
  suppliedToday: boolean;
  status: Status;
  pendingGoods: number;
}

export interface OwnedFranchise extends Base {
  hostId: number;
  hostName: string;
  hostAvatar: string;
}

export interface HostedFranchise extends Base {
  ownerId: number;
  ownerName: string;
  ownerAvatar: string;
}

/** A franchise as drawn on a lot (in your own city or a neighbor's). */
export interface LotFranchise {
  item: string;
  stars: number;
  pending: boolean;
  mine: boolean;
  ownerName: string;
  ownerAvatar: string;
  /** Goods waiting for the host to collect. */
  goods: number;
}

const stars = (n: number) => (n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : t('franchise.newStore'));

export class Franchises {
  owned: OwnedFranchise[] = [];
  hosted: HostedFranchise[] = [];
  private seenRequests = new Set<number>();

  constructor(
    private ctrl: Controller,
    private online: { loggedIn: boolean; username(): string; avatar(): string; needsAccount(): void },
  ) {}

  async refresh(): Promise<void> {
    if (!this.online.loggedIn) return;
    const r = await api<{ owned: OwnedFranchise[]; hosted: HostedFranchise[] }>('franchises');
    if (!r.ok) return;
    this.owned = r.owned;
    this.hosted = r.hosted;
    for (const f of this.hosted) {
      if (f.status !== 'pending' || this.seenRequests.has(f.id)) continue;
      this.seenRequests.add(f.id);
      toast(t('franchise.requested', { name: f.ownerName, shop: itemName(f.item) }), 'info', 'franchise', 5000);
    }
    if (!this.ctrl.visiting) this.ctrl.pushScene(false);
  }

  clear(): void {
    this.owned = [];
    this.hosted = [];
  }

  /** Franchises standing (or waiting) on your own lots, by lot id. */
  homeLots(): Map<number, LotFranchise> {
    const m = new Map<number, LotFranchise>();
    for (const f of this.hosted) {
      if (f.status === 'declined') continue;
      m.set(f.lotId, { item: f.item, stars: f.stars, pending: f.status === 'pending', mine: false, ownerName: f.ownerName, ownerAvatar: f.ownerAvatar, goods: f.pendingGoods });
    }
    return m;
  }

  /** Goods today's supply run needs (0 = nothing left to supply today). */
  supplyGoods(): number {
    let g = 0;
    for (const f of this.owned) if (f.status === 'active' && !f.suppliedToday) g += Math.ceil((maybeItem(f.item)?.goods ?? 0) / 2);
    return g;
  }

  // ------------------------------------------------------------ as owner

  /** A neighbor's Empty Lot was tapped during a visit: pick one of your shops to open there. */
  openPlace(hostId: number, hostName: string, lotId: number, onPlaced: (f: LotFranchise) => void): void {
    if (!this.online.loggedIn) return this.online.needsAccount();
    const mine = new Set<string>();
    for (const k in this.ctrl.state.objects) {
      const o = this.ctrl.state.objects[k]!;
      if (o.built && maybeItem(o.item)?.kind === 'business') mine.add(o.item);
    }
    const there = new Set(this.owned.filter((f) => f.hostId === hostId && f.status !== 'declined').map((f) => f.item));
    let handle: DialogHandle | null = null;
    const rows = [...mine]
      .sort((a, b) => franchiseCost(a) - franchiseCost(b))
      .map((item) => {
        const cost = franchiseCost(item);
        const def = maybeItem(item)!;
        const open = button(
          t('franchise.open'),
          () => {
            handle?.close();
            void this.place(hostId, hostName, lotId, item, onPlaced);
          },
          'btn small honey',
          there.has(item) || this.ctrl.state.coins < cost ? { disabled: true } : undefined,
        );
        const note = there.has(item) ? t('franchise.alreadyThere') : t('franchise.cost', { coins: fmt(cost) });
        return el('div', { class: 'row' }, el('div', { class: 'thumb small' }, thumbFor(def)), el('div', { class: 'grow' }, el('div', { class: 't1', text: itemName(item) }), el('div', { class: 't2', text: note })), open);
      });
    handle = openDialog({
      title: t('franchise.placeTitle'),
      icon: 'franchise',
      body: rows.length ? [el('p', { text: t('franchise.placeIntro', { name: hostName }) }), ...rows] : [el('p', { text: t('franchise.noShops') })],
      actions: [{ label: t('dlg.close'), cls: 'plain', onClick: () => {} }],
    });
  }

  private async place(hostId: number, hostName: string, lotId: number, item: string, onPlaced: (f: LotFranchise) => void): Promise<void> {
    if (!this.ctrl.dispatch({ t: 'franchisePay', item })) return;
    const r = await api<{ id: number; cost: number }>('franchise_place', { hostId, lotId, item });
    if (!r.ok) {
      // the request didn't go through: give the coins back
      this.ctrl.dispatch({ t: 'grant', reward: { coins: franchiseCost(item) }, key: `frefund:${hostId}:${lotId}:${item}:${this.ctrl.now()}` }, { quiet: true });
      const msg = r.error === 'taken' ? 'franchise.taken' : r.error === 'notOwned' ? 'franchise.notOwned' : r.offline ? 'online.offline' : 'franchise.failed';
      toast(t(msg), 'bad', 'warning', 4500);
      return;
    }
    this.ctrl.audio.play('build');
    toast(t('franchise.sent', { name: hostName }), 'good', 'franchise', 4500);
    onPlaced({ item, stars: 0, pending: true, mine: true, ownerName: this.online.username(), ownerAvatar: this.online.avatar(), goods: 0 });
    void this.refresh();
  }

  /** The once-a-day supply run to every active franchise. */
  async supplyAll(after?: () => void): Promise<void> {
    const need = this.supplyGoods();
    if (!need) return;
    if (this.ctrl.state.goods < need) {
      toast(t('franchise.needGoods', { n: fmt(need) }), 'bad', 'goods');
      return;
    }
    const r = await api<{ delivered: number; goodsCost: number; reward: Reward; day: string }>('franchise_supply', {});
    if (!r.ok) {
      toast(t(r.offline ? 'online.offline' : 'franchise.failed'), 'bad', 'warning');
      return;
    }
    if (r.delivered > 0) {
      this.ctrl.dispatch({ t: 'franchiseSupply', goods: r.goodsCost, reward: r.reward, key: `fsupply:${r.day}:${this.ctrl.now()}` }, { quiet: true });
      this.ctrl.audio.play('supply');
      toast(t(r.delivered === 1 ? 'franchise.supplied.one' : 'franchise.supplied', { n: r.delivered }), 'good', 'franchise');
    }
    await this.refresh();
    after?.();
  }

  /** Your franchise empire: every franchise you run, the daily supply run and refunds. */
  openHQ(): void {
    if (!this.online.loggedIn) return this.online.needsAccount();
    let handle: DialogHandle | null = null;
    const render = (): Node[] => {
      const out: Node[] = [el('p', { text: t('franchise.hqIntro') })];
      if (this.owned.length === 0) {
        out.push(el('p', { class: 'muted center', text: t('franchise.none') }));
        return out;
      }
      const need = this.supplyGoods();
      if (need > 0) {
        out.push(
          el(
            'div',
            { class: 'center' },
            button(el('span', null, ico('goods'), t('franchise.supplyAll', { n: fmt(need) })), () => void this.supplyAll(() => handle?.setBody(render())), 'btn honey'),
          ),
        );
      } else if (this.owned.some((f) => f.status === 'active')) {
        out.push(el('p', { class: 'muted center', text: t('franchise.allSupplied') }));
      }
      for (const f of this.owned) {
        const def = maybeItem(f.item);
        const status =
          f.status === 'pending' ? t('franchise.waiting') : f.status === 'declined' ? t('franchise.declined') : `${stars(f.stars)} · ${t(f.deliveries === 1 ? 'franchise.deliveries.one' : 'franchise.deliveries', { n: f.deliveries })}`;
        const side =
          f.status === 'declined'
            ? button(t('franchise.refund', { coins: fmt(franchiseCost(f.item)) }), () => void this.remove(f, () => handle?.setBody(render())), 'btn small')
            : el('span', { class: 'chip', text: f.status === 'active' && f.suppliedToday ? t('franchise.suppliedChip') : '' });
        out.push(el('div', { class: 'row' }, def ? el('div', { class: 'thumb small' }, thumbFor(def)) : ico('franchise'), el('div', { class: 'grow' }, el('div', { class: 't1', text: `${itemName(f.item)} · ${f.hostName}` }), el('div', { class: 't2', text: status })), side));
      }
      return out;
    };
    handle = openDialog({ id: 'franchises', title: t('franchise.hqTitle'), icon: 'franchise', body: render(), size: 'mid' });
    void this.refresh().then(() => handle?.setBody(render()));
  }

  private async remove(f: OwnedFranchise, after: () => void): Promise<void> {
    const r = await api<{ refund: number }>('franchise_remove', { id: f.id });
    if (!r.ok) {
      toast(t(r.offline ? 'online.offline' : 'franchise.failed'), 'bad', 'warning');
      return;
    }
    this.ctrl.dispatch({ t: 'grant', reward: { coins: r.refund }, key: `fremove:${f.id}` }, { quiet: true });
    await this.refresh();
    after();
  }

  // ------------------------------------------------------------- as host

  /** One of your own Empty Lots was tapped. */
  openLot(lotId: number): void {
    if (!this.online.loggedIn) {
      openDialog({
        title: t('item.emptylot'),
        icon: 'franchise',
        body: el('p', { text: t('franchise.lotOffline') }),
        actions: [
          { label: t('dlg.close'), cls: 'plain', onClick: () => {} },
          { label: t('account.signIn'), onClick: () => this.online.needsAccount() },
        ],
      });
      return;
    }
    const f = this.hosted.find((x) => x.lotId === lotId && x.status !== 'declined');
    if (!f) {
      openDialog({ title: t('item.emptylot'), icon: 'franchise', body: el('p', { text: t('franchise.lotEmpty') }), actions: [{ label: t('dlg.ok'), onClick: () => {} }] });
      return;
    }
    const def = maybeItem(f.item);
    const head = el('div', { class: 'row' }, def ? el('div', { class: 'thumb small' }, thumbFor(def)) : ico('franchise'), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('franchise.ownedBy', { name: f.ownerName, shop: itemName(f.item) }) }), el('div', { class: 't2', text: f.status === 'pending' ? t('franchise.askAccept') : `${stars(f.stars)} · ${t(f.deliveries === 1 ? 'franchise.deliveries.one' : 'franchise.deliveries', { n: f.deliveries })}` })));
    if (f.status === 'pending') {
      openDialog({
        title: t('franchise.requestTitle'),
        icon: 'franchise',
        body: [head, el('p', { class: 'muted', text: t('franchise.requestNote') })],
        actions: [
          { label: t('franchise.decline'), cls: 'plain', onClick: () => void this.answer(f, false) },
          { label: t('franchise.accept'), onClick: () => void this.answer(f, true) },
        ],
      });
      return;
    }
    const actions: { label: string; onClick: () => void; cls?: string }[] = [
      { label: t('franchise.close'), cls: 'plain', onClick: () => confirmDialog(t('franchise.close'), t('franchise.closeConfirm', { name: f.ownerName }), t('franchise.close'), () => void this.answer(f, false), true) },
    ];
    if (f.pendingGoods > 0) actions.push({ label: t('franchise.collect', { n: fmt(f.pendingGoods) }), onClick: () => void this.collect(f) });
    else actions.push({ label: t('dlg.ok'), onClick: () => {} });
    openDialog({ title: t('franchise.hostTitle'), icon: 'franchise', body: [head, el('p', { class: 'muted', text: f.pendingGoods > 0 ? t('franchise.goodsWaiting', { n: fmt(f.pendingGoods) }) : t('franchise.noGoods') })], actions });
  }

  private async answer(f: HostedFranchise, accept: boolean): Promise<void> {
    const r = await api('franchise_accept', { id: f.id, accept });
    if (!r.ok) {
      toast(t(r.offline ? 'online.offline' : 'franchise.failed'), 'bad', 'warning');
      return;
    }
    if (accept) {
      this.ctrl.audio.play('goal');
      toast(t('franchise.opened', { name: f.ownerName, shop: itemName(f.item) }), 'good', 'franchise');
    }
    await this.refresh();
  }

  private async collect(f: HostedFranchise): Promise<void> {
    const r = await api<{ goods: number }>('franchise_collect', { ids: [f.id] });
    if (!r.ok) {
      toast(t(r.offline ? 'online.offline' : 'franchise.failed'), 'bad', 'warning');
      return;
    }
    if (r.goods > 0) this.ctrl.dispatch({ t: 'grant', reward: { goods: r.goods }, key: `fcollect:${f.id}:${this.ctrl.now()}` }, { objId: f.lotId });
    await this.refresh();
  }
}
