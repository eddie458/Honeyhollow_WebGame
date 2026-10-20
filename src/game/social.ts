// Neighbors: the two built-in NPC towns (always available, even offline) and,
// when logged in, online friends. Handles visiting, help actions, help and
// gifts received, plus routing to the harbor / rail / wonder dialogs.
import type { SceneSource } from '../render/CityScene';
import {
  bestHelp,
  buildNpcTown,
  content,
  cropStage,
  dayKey,
  maybeItem,
  rectOf,
  shipReady,
  trainReady,
  WorldIndex,
  type GameState,
  type HelpAction,
} from '../sim';
import { el, ico, button } from '../ui/dom';
import { openDialog } from '../ui/dialog';
import { t } from '../ui/i18n';
import { toast } from '../ui/overlay';
import { openObjectInfo } from '../ui/panels';
import { openParts, openPier, openTrain, openWonder } from '../ui/special';
import type { Neighbor } from '../ui/types';
import type { Controller } from './controller';
import type { LotFranchise } from './franchises';
import { Online } from './online';

interface Visit {
  key: string;
  npc?: string;
  userId?: number;
  name: string;
  town: string;
  avatar: string;
  level: number;
  state: GameState;
  index: WorldIndex;
  helped: Set<number>;
  day: string;
  /** Help actions left (server-reported for friends). */
  left: number;
  /** Franchises on the host's Empty Lots (friends only), by lot id. */
  lots?: Map<number, LotFranchise>;
}

const HELP_SFX: Record<HelpAction, 'harvest' | 'plant' | 'supply' | 'build' | 'whoosh'> = {
  harvest: 'harvest',
  water: 'plant',
  revive: 'plant',
  tourbus: 'supply',
  build: 'build',
  clean: 'whoosh',
};

export class Social {
  private visitData: Visit | null = null;
  readonly online: Online;

  constructor(private ctrl: Controller) {
    this.online = new Online(ctrl, this);
  }

  get visiting(): boolean {
    return this.visitData !== null;
  }

  get isOnline(): boolean {
    return this.online.loggedIn;
  }

  today(): string {
    return dayKey(this.ctrl.now(), this.ctrl.tz);
  }

  tick(now: number): void {
    this.online.tick(now);
  }

  // ------------------------------------------------------------ neighbors

  neighbors(): Neighbor[] {
    const day = this.today();
    const out: Neighbor[] = content().npcs.map((n) => {
      const st = this.ctrl.state.npc[n.id];
      const used = st && st.day === day ? st.helps : 0;
      return {
        key: `npc:${n.id}`,
        name: t(`char.${n.id}`).split(' ')[0]!,
        town: t(`town.${n.town}`),
        avatar: n.avatar,
        level: n.level,
        npc: true,
        helpsLeft: Math.max(0, content().balance.visit.helpsPerDay - used),
        canGift: false,
      };
    });
    return [...this.online.friendNeighbors(), ...out];
  }

  /** Train stops: every neighbor can be a stop. */
  trainStops(): { key: string; name: string; avatar: string }[] {
    return this.neighbors().map((n) => ({ key: n.key, name: n.name, avatar: n.avatar }));
  }

  // ------------------------------------------------------------- visiting

  visit(key: string): void {
    if (key.startsWith('npc:')) {
      const npc = content().npcs.find((n) => `npc:${n.id}` === key);
      if (!npc) return;
      const day = this.today();
      const state = buildNpcTown(npc, day, this.ctrl.now());
      const st = this.ctrl.state.npc[npc.id];
      const helped = new Set(st && st.day === day ? st.helped : []);
      for (const id of helped) {
        const o = state.objects[id];
        if (o) o.helpedAt = this.ctrl.now();
      }
      const used = st && st.day === day ? st.helps : 0;
      this.enter({
        key,
        npc: npc.id,
        name: t(`char.${npc.id}`),
        town: t(`town.${npc.town}`),
        avatar: npc.avatar,
        level: npc.level,
        state,
        index: new WorldIndex(state),
        helped,
        day,
        left: Math.max(0, content().balance.visit.helpsPerDay - used),
      });
      if (this.ctrl.dispatch({ t: 'visitBonus', npc: npc.id, day }, { quiet: true })) {
        const b = content().balance.visit.bonus;
        toast(t('visit.bonus', { coins: b.coins, energy: b.energy }), 'good', 'gift');
      }
      return;
    }
    if (key.startsWith('user:')) void this.online.visitFriend(Number(key.slice(5)));
  }

  /** Shared entry for NPC and friend visits. */
  enter(v: Visit): void {
    this.visitData = v;
    this.ctrl.cancelMode();
    this.ctrl.pushScene(true);
    this.ctrl.hud.setVisiting(true);
    this.renderVisitHud();
    this.ctrl.refreshUi();
    this.ctrl.audio.play('whoosh');
  }

  endVisit(): void {
    if (!this.visitData) return;
    this.visitData = null;
    this.ctrl.hud.setVisiting(false);
    this.ctrl.pushScene(true);
    this.ctrl.scene.focusDefault();
    this.ctrl.refreshUi();
    this.ctrl.audio.play('whoosh');
  }

  private renderVisitHud(): void {
    const v = this.visitData;
    if (!v) return;
    const hud = this.ctrl.hud;
    hud.visitBanner.replaceChildren(
      ico(v.avatar),
      el('div', null, el('div', { text: v.town }), el('div', { class: 'muted', text: `${v.name} · ${t('hud.level', { level: v.level })}` })),
      button(el('span', null, ico('visit'), t('visit.home')), () => this.endVisit(), 'btn small honey'),
    );
    const max = content().balance.visit.helpsPerDay;
    hud.visitBar.replaceChildren(el('div', { class: 'muted center', text: t('visit.helpsShort') }));
    for (let i = 0; i < max; i++) {
      const bolt = ico('energy');
      if (i >= v.left) bolt.classList.add('used');
      bolt.setAttribute('aria-hidden', 'true');
      hud.visitBar.append(bolt);
    }
    hud.visitBar.setAttribute('aria-label', t('visit.helps', { n: v.left }));
    hud.visitBar.title = t('visit.helps', { n: v.left });
  }

  sceneSource(): SceneSource {
    const v = this.visitData!;
    const helpable = new Set<number>();
    if (v.left > 0) {
      for (const k in v.state.objects) {
        const o = v.state.objects[k]!;
        if (!v.helped.has(o.id) && bestHelp(v.state, o, this.ctrl.now())) helpable.add(o.id);
      }
    }
    return { key: v.key, state: v.state, index: v.index, visiting: true, glow: v.helped, helpers: new Map(), helpable, ...(v.lots ? { franchises: v.lots } : {}) };
  }

  /** Tapping something in a neighbor's town spends one help action (Empty Lots take franchises instead). */
  tapObject(id: number): void {
    const v = this.visitData;
    if (!v) return;
    const o = v.state.objects[id];
    if (!o) return;
    if (maybeItem(o.item)?.kind === 'emptyLot') return this.tapLot(v, id);
    if (v.left <= 0) return toast(t('visit.noHelps'), 'info', 'energy');
    if (v.helped.has(id)) return toast(t('visit.alreadyHelped'), 'info', 'help');
    const action = bestHelp(v.state, o, this.ctrl.now());
    if (!action) return toast(t('visit.nothing'), 'info', 'help');
    const r = rectOf(o);
    const at: [number, number] = [r.x + r.w / 2, r.y + r.h / 2];
    if (v.npc) {
      const ok = this.ctrl.dispatch({ t: 'helpReward', reward: {}, npc: v.npc, objectId: id, day: v.day, key: `help:npc:${v.npc}:${v.day}:${id}`, at });
      if (!ok) return;
      this.applyVisual(v, id, action);
    } else if (v.userId !== undefined) {
      void this.online.helpFriend(v, id, action, at);
    }
  }

  /** A neighbor's Empty Lot: open a franchise there, or see whose shop stands on it. */
  private tapLot(v: Visit, id: number): void {
    const here = v.lots?.get(id);
    if (here) {
      const key = here.pending ? 'franchise.lotPending' : 'franchise.lotTaken';
      return toast(t(key, { name: here.ownerName, shop: t(`item.${here.item}`) }), 'info', 'franchise', 4000);
    }
    if (v.userId === undefined) return toast(t('franchise.npcLot'), 'info', 'franchise');
    this.online.franchises.openPlace(v.userId, v.name, id, (f) => {
      v.lots ??= new Map();
      v.lots.set(id, f);
      this.ctrl.pushScene(false);
    });
  }

  /** Shows the effect of a help action in the visited town. */
  applyVisual(v: Visit, id: number, action: HelpAction): void {
    const o = v.state.objects[id];
    if (!o) return;
    const now = this.ctrl.now();
    v.helped.add(id);
    v.left = Math.max(0, v.left - 1);
    o.helpedAt = now;
    const def = maybeItem(o.item);
    switch (action) {
      case 'harvest':
        o.crop = null;
        break;
      case 'revive':
        if (o.crop) {
          const crop = content().crops[o.crop.id];
          if (crop) o.crop.plantedAt = now - crop.time * 1000;
        }
        break;
      case 'water':
        if (o.crop && cropStage(v.state, o, now) !== 'ripe') {
          const crop = content().crops[o.crop.id];
          if (crop) o.crop.boost = (o.crop.boost ?? 0) + crop.time * content().balance.crops.waterSeconds;
        }
        break;
      case 'tourbus':
        if (o.shop && def) o.shop.served = Math.min(def.goods ?? 10, o.shop.served + Math.ceil((def.goods ?? 10) * 0.35));
        this.ctrl.scene.tourBus(id);
        break;
      case 'build':
        o.clicks += 1;
        if (def && o.clicks >= (def.clicks ?? 0)) o.built = true;
        break;
      default:
        break;
    }
    v.index = new WorldIndex(v.state);
    this.ctrl.audio.play(HELP_SFX[action]);
    this.ctrl.scene.puffAt(id, 0x9fd0ff);
    this.ctrl.pushScene(action === 'build');
    this.renderVisitHud();
    this.ctrl.refreshUi();
    if (v.left === 0) toast(t('visit.allUsed', { name: v.name }), 'good', v.avatar, 3500);
  }

  // ---------------------------------------------------- help on your city

  /** Objects with pending neighbor help glow blue until accepted. */
  glowIds(): Set<number> {
    const out = new Set<number>();
    const s = this.ctrl.state;
    for (const h of s.helps) out.add(h.objectId);
    const now = s.now;
    for (const k in s.objects) {
      const o = s.objects[k]!;
      if (o.helpedAt && now - o.helpedAt < 20_000) out.add(o.id);
    }
    return out;
  }

  /** Helper portraits shown over objects with pending help. */
  helperAvatars(): Map<number, string> {
    const m = new Map<number, string>();
    for (const h of this.ctrl.state.helps) {
      if (!this.ctrl.state.objects[h.objectId]) continue;
      m.set(h.objectId, h.from.startsWith('npc:') ? h.from.slice(4) : this.online.avatarOf(h.from));
    }
    return m;
  }

  tapHelper(objectId: number): void {
    const helps = this.ctrl.state.helps.filter((h) => h.objectId === objectId);
    for (const h of helps) this.acceptHelp(h.id);
  }

  acceptHelp(id: string): void {
    const h = this.ctrl.state.helps.find((x) => x.id === id);
    if (!h) return;
    if (this.ctrl.dispatch({ t: 'acceptHelp', id }, { quiet: true })) {
      this.ctrl.audio.play('pop');
      if (h.action === 'tourbus') this.ctrl.scene.tourBus(h.objectId);
      this.ctrl.scene.puffAt(h.objectId, 0x9fd0ff);
      toast(t('help.accepted', { who: this.whoName(h.from) }), 'good', h.from.startsWith('npc:') ? h.from.slice(4) : 'help');
      this.online.ackHelp(h.id);
    }
  }

  whoName(from: string): string {
    if (from.startsWith('npc:')) return this.ctrl.npcLabel(from);
    return this.online.nameOf(from);
  }

  // ------------------------------------------------------ dialog routing

  openNeighbors(): void {
    this.online.openNeighbors();
  }

  openAccount(): void {
    this.online.openAccount();
  }

  cloudSave(s: GameState): void {
    this.online.cloudSave(s);
  }

  openPier(id: number): void {
    const o = this.ctrl.state.objects[id];
    if (!o) return;
    // a boat waiting at the dock is unloaded straight away (like collecting rent)
    const now = this.ctrl.now();
    const slot = (o.ships ?? []).findIndex((_, i) => shipReady(o, i, now));
    if (slot >= 0) {
      this.ctrl.dispatch({ t: 'unload', id, slot }, { objId: id });
      return;
    }
    openPier(this.ctrl, id);
  }

  openTrain(_id: number): void {
    if (trainReady(this.ctrl.state, this.ctrl.now())) {
      this.ctrl.dispatch({ t: 'trainCollect' });
      return;
    }
    openTrain(this.ctrl, this.trainStops());
  }

  openWonder(id: number): void {
    openWonder(this.ctrl, id);
  }

  openUpgrade(id: number): void {
    openObjectInfo(this.ctrl, id);
  }

  openParts(id: number): void {
    openParts(this.ctrl, id);
  }

  /** Friendly explanation used when a feature needs the online API. */
  needsAccount(): void {
    openDialog({
      title: t('tools.account'),
      icon: 'account',
      body: el('p', { text: t('online.needAccount') }),
      actions: [
        { label: t('dlg.cancel'), cls: 'plain', onClick: () => {} },
        { label: t('account.signIn'), onClick: () => this.online.openAccount() },
      ],
    });
  }
}

export type { Visit };
