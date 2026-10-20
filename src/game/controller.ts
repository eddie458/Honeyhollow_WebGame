// The game controller: owns the authoritative GameState, routes input from
// the city scene and the HUD into simulation actions, and turns simulation
// events into feedback (doobers, sounds, popups, tooltips, saves).
import type { SpriteBank } from '../art/atlas';
import { GameAudio, type Sfx } from '../audio/audio';
import type { CityScene, Mode, SceneEvents, SceneSource } from '../render/CityScene';
import { exportSave as downloadSave, pickSaveFile, savePrefs, writeLocalSave, clearLocalSave, type Prefs } from '../save/storage';
import {
  advance,
  applyAction,
  createNewGame,
  cropStage,
  currentShopRate,
  dailyAvailable,
  dayKey,
  energyNextIn,
  maybeItem,
  SaveError,
  WorldIndex,
  type Action,
  type Drop,
  type ErrorCode,
  type GameState,
  type Reward,
  type SimEvent,
  type WorldObject,
} from '../sim';
import { openBuildMenu, isBuildOpen, setThumbBank } from '../ui/build';
import { anyDialogOpen, closeTopDialog, confirmDialog, isOpen, openDialog } from '../ui/dialog';
import { el } from '../ui/dom';
import { GoalsColumn, npcName, openGoalComplete, openGoalDialog } from '../ui/goalsUi';
import { Hints } from '../ui/hints';
import { Hud, type Pending } from '../ui/hud';
import { BonusBar } from '../ui/bonusbar';
import { fmt, itemName, t } from '../ui/i18n';
import { bumpHud, flyTo, hideTip, levelBurst, showTip, toast } from '../ui/overlay';
import {
  openCollections,
  openDaily,
  openExpand,
  openGifts,
  openIntro,
  openInventory,
  openLevelUp,
  openNoEnergy,
  openObjectInfo,
  openSeedPicker,
  openSettings,
  openStaff,
} from '../ui/panels';
import { objectTip } from '../ui/tips';
import type { Ctrl, Neighbor, Tool } from '../ui/types';
import { dooberIcon } from '../render/doobers';
import { activeEvents } from './events';
import { Social } from './social';

export const VERSION = '1.0.0';

/** Adds the amounts of reward b into reward a (used to merge popups). */
function mergeReward(a: Reward, b: Reward): void {
  for (const k of ['coins', 'xp', 'energy', 'goods', 'volunteers', 'permits', 'reputation'] as const) {
    const v = b[k];
    if (v) a[k] = (a[k] ?? 0) + v;
  }
  for (const k of ['parts', 'items', 'collectibles'] as const) {
    const m = b[k];
    if (!m) continue;
    const into = (a[k] ??= {});
    for (const [id, n] of Object.entries(m)) into[id] = (into[id] ?? 0) + n;
  }
}

const PENDING_KINDS = ['coins', 'xp', 'energy', 'goods'] as const;

export class Controller implements Ctrl {
  state: GameState;
  index: WorldIndex;
  readonly audio: GameAudio;
  scene!: CityScene;
  hud!: Hud;
  private goalsCol!: GoalsColumn;
  private hints!: Hints;
  private bonusBar!: BonusBar;
  readonly pending: Pending = { coins: 0, xp: 0, energy: 0, goods: 0 };
  private dirty = false;
  /** True once another tab took over this city (see tabguard.ts). */
  asleep = false;
  private tool: Tool | null = null;
  private hoverId: number | null = null;
  private hoverPos = { x: 0, y: 0 };
  private popups: (() => void)[] = [];
  private popupOpen = false;
  private levelPopup: { from: number; level: number; reward: Reward; shown: boolean } | null = null;
  private goalPopup: { ids: string[]; shown: boolean } | null = null;
  private revealed = new Set<string>();
  readonly tz = new Date().getTimezoneOffset();
  readonly social: Social;

  constructor(state: GameState, readonly prefs: Prefs, bank: SpriteBank) {
    this.state = state;
    this.index = new WorldIndex(state);
    this.audio = new GameAudio(prefs);
    this.social = new Social(this);
    setThumbBank(bank);
  }

  get visiting(): boolean {
    return this.social.visiting;
  }

  now(): number {
    return Date.now();
  }

  // ------------------------------------------------------------------ setup

  mountUi(root: HTMLElement): void {
    this.bonusBar = new BonusBar(
      (pickups) => this.payBonus(pickups),
      (stage) => {
        this.audio.play('bonus');
        if (stage >= 1) bumpHud(this.bonusBar.node);
      },
    );
    this.hud = new Hud(this, this.bonusBar);
    root.prepend(this.hud.root);
    this.goalsCol = new GoalsColumn(this, this.hud.goals);
    this.hints = new Hints({ locate: (target) => this.locateHint(target), busy: () => anyDialogOpen() || this.popupOpen });
    this.hints.enabled = this.prefs.hints;
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveNow();
    });
    window.addEventListener('pagehide', () => {
      this.saveNow();
      this.social.online.cloudSave(this.state, true);
    });
    this.applyPrefs();
  }

  attachScene(scene: CityScene): void {
    this.scene = scene;
    this.pushScene(true);
    this.refreshUi();
    window.setInterval(() => this.tick(), 250);
    window.setInterval(() => {
      if (this.dirty) this.saveNow();
    }, 10_000);
  }

  private sceneEvents: SceneEvents = {
    tapObject: (id) => this.onTapObject(id),
    tapTile: () => {
      if (this.tool) return;
      hideTip();
    },
    place: (x, y, rot) => this.onPlace(x, y, rot),
    hover: (id, x, y) => this.onHover(id, x, y),
    pickup: (d, x, y) => this.onPickup(d, x, y),
    tapHelper: (id) => this.social.tapHelper(id),
    tapLot: (lx, ly) => this.onTapLot(lx, ly),
  };

  /** Re-renders the scene from the current (or visited) state. */
  pushScene(structural: boolean): void {
    const src: SceneSource = this.social.visiting
      ? this.social.sceneSource()
      : {
          key: 'home',
          state: this.state,
          index: this.index,
          visiting: false,
          glow: this.social.glowIds(),
          helpers: this.social.helperAvatars(),
          helpable: new Set(),
          franchises: this.social.online.franchises.homeLots(),
        };
    this.scene.attach(src, this.sceneEvents, structural);
    const rate = currentShopRate(src.state, src.state.now, src.index);
    this.scene.setShopRates(rate.residentsPerMin, rate.touristsPerMin);
  }

  start(firstRun: boolean): void {
    const day = dayKey(this.now(), this.tz);
    // NPC neighbors drop by once a day (gifts + help on your city).
    // (not on the very first visit, so the tutorial city stays tidy)
    this.dispatch({ t: 'npcDaily', day, helps: !firstRun }, { quiet: true });
    if (firstRun) {
      this.queuePopup((done) => {
        openIntro(done);
      });
    }
    void this.social.online.init();
    if (!firstRun) this.announceEvents();
    if (dailyAvailable(this.state, this.now(), this.tz)) {
      this.queuePopup((done) => {
        openDaily(this, this.tz);
        this.waitForClose('daily', done);
      });
    }
    this.refreshUi();
  }

  /** Tells the player once per season that a seasonal event has started. */
  private announceEvents(): void {
    const now = this.now();
    const d = new Date(now);
    for (const ev of activeEvents(now)) {
      // a season that runs over New Year counts from the year it started
      const year = d.getMonth() + 1 < Number(ev.from.slice(0, 2)) ? d.getFullYear() - 1 : d.getFullYear();
      const flag = `event:${ev.id}:${year}`;
      if (this.state.flags[flag]) continue;
      this.dispatch({ t: 'flag', key: flag }, { quiet: true });
      this.queuePopup((done) => {
        openDialog({
          title: t(`event.${ev.id}.title`),
          icon: 'event',
          body: el('p', { text: t(`event.${ev.id}.text`) }),
          actions: [{ label: t('event.ok'), onClick: () => {} }],
          onClose: done,
        });
      });
    }
  }

  // --------------------------------------------------------------- dispatch

  dispatch(a: Action, opts: { quiet?: boolean; objId?: number } = {}): boolean {
    // while visiting only these touch your own city (rewards, franchise payments)
    if (this.social.visiting && !['flag', 'settings', 'helpReward', 'visitBonus', 'grant', 'franchisePay', 'franchiseSupply'].includes(a.t)) return false;
    const r = applyAction(this.state, a, this.now());
    if (!r.ok) {
      if (!opts.quiet) this.onError(r.error, r.detail, opts.objId);
      return false;
    }
    const structural = ['place', 'move', 'rotate', 'store', 'sell', 'expand', 'upgrade'].includes(a.t);
    if (a.t === 'wishlist') this.social.online.syncWishlist(r.state.wishlist);
    this.commit(r.state, r.events, structural);
    if (!opts.quiet) this.actionSound(a);
    return true;
  }

  private commit(state: GameState, events: SimEvent[], structural: boolean): void {
    this.state = state;
    this.index = new WorldIndex(state);
    this.dirty = true;
    if (!this.social.visiting) this.pushScene(structural);
    for (const e of events) this.onEvent(e);
    this.refreshUi();
  }

  private actionSound(a: Action): void {
    const map: Partial<Record<Action['t'], Sfx>> = {
      build: 'build',
      finish: 'build',
      collect: 'cash',
      supply: 'supply',
      plant: 'plant',
      harvest: 'harvest',
      place: 'place',
      move: 'place',
      rotate: 'whoosh',
      store: 'whoosh',
      sell: 'cash',
      staff: 'pop',
      claimDaily: 'collectible',
      expand: 'expand',
      ship: 'whoosh',
      unload: 'harvest',
      train: 'whoosh',
      trainCollect: 'cash',
      upgrade: 'built',
      boost: 'level',
      acceptGift: 'collectible',
    };
    const s = map[a.t];
    if (s) this.audio.play(s);
  }

  private onError(code: ErrorCode, detail: string | undefined, objId?: number): void {
    this.audio.play('error');
    if (code === 'noEnergy') {
      openNoEnergy(this, energyNextIn(this.state, this.now()));
      return;
    }
    const msg = code === 'noGoods' ? t('err.noGoods', { need: detail ?? '?' }) : t(`err.${code}`);
    if (objId !== undefined && this.scene) this.scene.floatAt(objId, 0, 0, msg, '#ffd0c8');
    else toast(msg, 'bad', code === 'noCoins' ? 'coin' : code === 'noGoods' ? 'goods' : 'warning');
  }

  // ----------------------------------------------------------------- events

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case 'drops':
        for (const d of e.drops) if ((PENDING_KINDS as readonly string[]).includes(d.kind)) this.pending[d.kind as keyof Pending] += d.amount;
        if (Number.isFinite(e.x) && this.scene) {
          this.scene.spawnDrops(e.x, e.y, e.drops, e.objId);
          const coins = e.drops.filter((d) => d.kind === 'coins').reduce((n, d) => n + d.amount, 0);
          if (coins >= 10 && e.objId !== undefined) this.scene.floatAt(e.objId, 0, 0, `+${fmt(coins)}`, '#ffe28a');
        } else {
          this.flyFromCenter(e.drops);
        }
        break;
      case 'levelUp': {
        // several level-ups at once become one popup
        const lp = this.levelPopup;
        if (lp && !lp.shown) {
          lp.level = e.level;
          mergeReward(lp.reward, e.reward);
          break;
        }
        const next = { from: e.level, level: e.level, reward: { ...e.reward }, shown: false };
        this.levelPopup = next;
        this.queuePopup((done) => {
          next.shown = true;
          levelBurst(this.prefs.reducedMotion);
          openLevelUp(this, next.from, next.level, next.reward, done);
        });
        break;
      }
      case 'goalDone': {
        this.audio.play('goal');
        const gp = this.goalPopup;
        if (gp && !gp.shown) {
          gp.ids.push(e.id);
          break;
        }
        const next = { ids: [e.id], shown: false };
        this.goalPopup = next;
        this.queuePopup((done) => {
          next.shown = true;
          openGoalComplete(next.ids, done);
        });
        break;
      }
      case 'goalNew':
        break;
      case 'collectible':
        this.audio.play('collectible');
        toast(t('msg.collectible', { name: t(`c.${e.id}`) }), 'good', e.id);
        break;
      case 'collectionReady':
        toast(t('msg.collectionReady', { name: t(`coll.${e.id}`) }), 'good', 'collections', 4000);
        break;
      case 'achievement':
        this.audio.play('goal');
        toast(t('ach.unlocked', { name: t(`ach.${e.id}`), tier: t(`ach.tier.${e.tier}`) }), 'good', 'trophy', 5000);
        break;
      case 'moveIn':
        this.scene?.moveInVan(e.objId, e.pop);
        break;
      case 'built':
        this.audio.play('built');
        this.scene?.puffAt(e.objId, 0xfff3c4);
        break;
      case 'needsStaff':
        setTimeout(() => openStaff(this, e.objId), 450);
        break;
      case 'storageFull':
        toast(t('msg.storageFull', { lost: e.lost }), 'bad', 'goods', 4000);
        break;
      case 'mastery':
        toast(t('msg.mastery', { name: maybeItem(e.item) ? itemName(e.item) : t(`crop.${e.item}`), stars: e.stars }), 'good', 'star', 3500);
        break;
      case 'expanded':
        this.cancelMode();
        toast(t('expand.done'), 'good', 'expand');
        break;
      case 'boost':
        toast(t(`boost.${e.id}.on`), 'good', 'wonder', 4000);
        break;
      case 'message':
        if (e.key === 'msg.bonusPaid') {
          const coins = Number(e.params?.coins ?? 0);
          this.audio.play('cash');
          toast(t('msg.bonusPaid', { coins }), 'good', 'coin');
        } else toast(t(e.key, e.params), 'info');
        break;
      default:
        break;
    }
  }

  private flyFromCenter(drops: Drop[]): void {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    drops.forEach((d, i) => setTimeout(() => this.onPickup(d, cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 40, false), i * 70));
  }

  /** A doober was collected: fly it to its HUD counter. */
  private onPickup(d: Drop, x: number, y: number, countsForBonus = true): void {
    const target = this.hudTarget(d.kind);
    this.audio.play('pickup', this.bonusBar.count);
    if (countsForBonus && !this.social.visiting) this.bonusBar.pickup();
    flyTo(dooberIcon(d).replace(/^icon\./, ''), x, y, target, () => {
      if ((PENDING_KINDS as readonly string[]).includes(d.kind)) {
        const k = d.kind as keyof Pending;
        this.pending[k] = Math.max(0, this.pending[k] - d.amount);
      }
      bumpHud(target);
      this.hud.update(this.pending, this.tz);
    }, this.prefs.reducedMotion);
  }

  private payBonus(pickups: number): void {
    this.dispatch({ t: 'bonus', pickups }, { quiet: true });
  }

  hudTarget(kind: string): Element | null {
    return this.hud?.target(kind) ?? null;
  }

  // ------------------------------------------------------------------ popups

  queuePopup(fn: (done: () => void) => void): void {
    this.popups.push(() => fn(() => this.nextPopup()));
    if (!this.popupOpen) this.nextPopup();
  }

  private nextPopup(): void {
    const next = this.popups.shift();
    if (!next) {
      this.popupOpen = false;
      this.refreshUi();
      return;
    }
    this.popupOpen = true;
    setTimeout(next, 350);
  }

  private waitForClose(id: string, done: () => void): void {
    const check = window.setInterval(() => {
      if (!isOpen(id)) {
        clearInterval(check);
        done();
      }
    }, 250);
  }

  // -------------------------------------------------------------- the tick

  private tick(): void {
    const now = this.now();
    const prev = this.state;
    const next = advance(prev, now);
    this.state = next;
    // positions don't change while time passes: keep the index, swap state
    this.index.rebind(next);
    this.social.tick(now);
    if (this.scene) this.pushScene(false);
    this.hud.update(this.pending, this.tz);
    this.goalsCol.render();
    if (this.hoverId !== null && !this.social.visiting) this.showHover(this.hoverId);
  }

  refreshUi(): void {
    if (!this.hud) return;
    this.hud.update(this.pending, this.tz);
    this.goalsCol.render();
    this.hud.renderNeighbors();
    this.hints.enabled = this.prefs.hints && !this.social.visiting;
    this.hints.update(this.state, anyDialogOpen() || this.popupOpen);
  }

  // ------------------------------------------------------------------ input

  private onTapObject(id: number): void {
    hideTip();
    if (this.social.visiting) return this.social.tapObject(id);
    const o = this.state.objects[id];
    if (!o) return;
    const def = maybeItem(o.item);
    if (!def) return;
    if (this.tool) return this.useTool(this.tool, o);
    const now = this.now();
    const total = def.clicks ?? 0;
    this.audio.play('click');
    if (!o.built && total > 0) {
      if (o.clicks < total) {
        if (this.dispatch({ t: 'build', id }, { objId: id })) {
          this.scene.bounce(id);
          this.scene.puffAt(id);
        }
        return;
      }
      if (def.jobs && (o.staff?.length ?? 0) < def.jobs) return openStaff(this, id);
      if (def.parts) return this.social.openParts(id);
      this.dispatch({ t: 'build', id }, { objId: id });
      return;
    }
    switch (def.kind) {
      case 'house':
        if ((o.readyAt ?? 0) <= now) this.dispatch({ t: 'collect', id }, { objId: id });
        else this.showHover(id, true);
        return;
      case 'business': {
        const st = o.shop?.state;
        if (st === 'opening' || st === 'empty') this.dispatch({ t: 'supply', id }, { objId: id });
        else if (st === 'soldout') this.dispatch({ t: 'collect', id }, { objId: id });
        else openObjectInfo(this, id);
        return;
      }
      case 'plot': {
        const stage = cropStage(this.state, o, now);
        if (!o.crop) return openSeedPicker(this, id);
        if (stage === 'ripe') this.dispatch({ t: 'harvest', id }, { objId: id });
        else if (stage === 'withered') this.dispatch({ t: 'clearPlot', id }, { objId: id });
        else this.showHover(id, true);
        return;
      }
      case 'pier':
        return this.social.openPier(id);
      case 'station':
        return this.social.openTrain(id);
      case 'wonder':
        return this.social.openWonder(id);
      case 'emptyLot':
        return this.social.online.franchises.openLot(id);
      case 'hq':
        return this.social.online.franchises.openHQ();
      default:
        if (def.profit && (o.readyAt ?? 0) <= now) {
          this.dispatch({ t: 'collect', id }, { objId: id });
          return;
        }
        if (def.upgrades) return this.social.openUpgrade(id);
        this.showHover(id, true);
    }
  }

  private useTool(tool: Tool, o: WorldObject): void {
    const def = maybeItem(o.item)!;
    const name = o.shop?.name || itemName(o.item);
    switch (tool) {
      case 'move':
        if (def.noMove) return this.onError('invalid', undefined, o.id);
        this.scene.setMode({ kind: 'place', item: o.item, rot: o.rot, fromInventory: false, moveId: o.id });
        this.hud.setMode(t('tools.placeHint'), !def.noRotate, 'move');
        return;
      case 'rotate':
        this.dispatch({ t: 'rotate', id: o.id }, { objId: o.id });
        return;
      case 'store': {
        if (def.noStore || def.kind === 'road' || def.kind === 'sidewalk') return this.onError('invalid', undefined, o.id);
        const text = def.kind === 'plot' && o.crop ? t('confirm.storeCrop') : t('confirm.store', { name });
        confirmDialog(t('tools.store'), text, t('tools.store'), () => void this.dispatch({ t: 'store', id: o.id }));
        return;
      }
      case 'sell': {
        if (def.noSell) return this.onError('invalid', undefined, o.id);
        const coins = Math.floor(def.price * 0.25);
        if (def.kind === 'road' || def.kind === 'sidewalk' || def.price <= 50) {
          this.dispatch({ t: 'sell', id: o.id });
          return;
        }
        confirmDialog(t('tools.sell'), t('confirm.sell', { name, coins: fmt(coins) }), t('tools.sell'), () => void this.dispatch({ t: 'sell', id: o.id }), true);
      }
    }
  }

  private onPlace(x: number, y: number, rot: 0 | 1): boolean {
    const mode = this.scene.getMode();
    if (mode.kind !== 'place') return false;
    if (mode.moveId !== undefined) {
      const ok = this.dispatch({ t: 'move', id: mode.moveId, x, y, rot }, { objId: mode.moveId });
      if (ok) {
        this.scene.setMode({ kind: 'tool', tool: 'move' });
        this.hud.setMode(t('tools.moveHint'), false, 'move');
      } else {
        this.placeError(x, y, mode);
      }
      return ok;
    }
    const ok = this.dispatch({ t: 'place', item: mode.item, x, y, rot, fromInventory: mode.fromInventory }, { quiet: true });
    if (!ok) {
      this.placeError(x, y, mode);
      return false;
    }
    const def = maybeItem(mode.item)!;
    this.audio.play('place');
    const repeat = !mode.fromInventory && ['road', 'sidewalk', 'plot', 'decoration'].includes(def.kind) && this.state.coins >= def.price;
    const again = mode.fromInventory && (this.state.inventory[mode.item] ?? 0) > 0;
    if (!repeat && !again) this.cancelMode();
    else this.scene.setMode({ ...mode });
    return true;
  }

  private placeError(x: number, y: number, mode: Mode): void {
    if (mode.kind !== 'place') return;
    const r = applyAction(this.state, mode.moveId !== undefined ? { t: 'move', id: mode.moveId, x, y, rot: mode.rot } : { t: 'place', item: mode.item, x, y, rot: mode.rot, fromInventory: mode.fromInventory }, this.now());
    if (r.ok) return;
    this.audio.play('error');
    const def = maybeItem(mode.item);
    const [w, h] = def ? def.size : [1, 1];
    const msg = r.error === 'needsRoad' ? t('place.needsRoad') : r.error === 'blocked' ? t('place.blocked') : r.error === 'notOwned' ? t('place.notOwned') : r.error === 'noEnergy' ? t('err.noEnergy') : t(`err.${r.error}`);
    this.scene.floatAt(null, x + w / 2, y + h / 2, msg, '#ffd0c8');
    if (r.error === 'popCap') toast(t('err.popCap'), 'bad', 'population', 4000);
  }

  private onHover(id: number | null, x: number, y: number): void {
    this.hoverPos = { x, y };
    if (id === null || this.scene.getMode().kind === 'place') {
      this.hoverId = null;
      hideTip();
      return;
    }
    this.hoverId = id;
    this.showHover(id);
  }

  private showHover(id: number, fromTap = false): void {
    const src = this.social.visiting ? this.social.sceneSource() : null;
    const s = src ? src.state : this.state;
    const index = src ? src.index : this.index;
    const o = s.objects[id];
    if (!o) return hideTip();
    if (fromTap) {
      const css = this.scene.objectCss(id);
      if (css) this.hoverPos = { x: css[0] - 20, y: css[1] };
      this.hoverId = id;
      setTimeout(() => {
        if (this.hoverId === id) {
          this.hoverId = null;
          hideTip();
        }
      }, 2600);
    }
    showTip(objectTip(s, index, o, this.now(), this.social.visiting), this.hoverPos.x, this.hoverPos.y);
  }

  private onTapLot(lx: number, ly: number): void {
    if (this.social.visiting) return;
    const ok = this.state.lots.includes(`${lx},${ly}`);
    if (ok) return;
    openExpand(this, lx, ly);
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      if (e.key === 'Escape') target.blur();
      return;
    }
    const k = e.key;
    if (k === 'Escape') {
      if (closeTopDialog()) return;
      if (this.social.visiting) return this.endVisit();
      this.cancelMode();
      return;
    }
    if (anyDialogOpen()) return;
    if (k === 'r' || k === 'R') {
      if (this.scene.getMode().kind === 'place') this.rotateGhost();
      else this.setTool('rotate');
    } else if (k === 'm' || k === 'M') this.setTool('move');
    else if (k === 'b' || k === 'B') this.openBuild();
    else if (k === '+' || k === '=') this.zoom(1.2);
    else if (k === '-' || k === '_') this.zoom(1 / 1.2);
    else return;
    e.preventDefault();
  }

  // ------------------------------------------------------------------- modes

  startPlacing(item: string, fromInventory = false): void {
    if (this.social.visiting) return;
    const def = maybeItem(item);
    if (!def) return;
    this.tool = null;
    this.scene.setMode({ kind: 'place', item, rot: 0, fromInventory });
    const roadish = def.kind === 'road' || def.kind === 'sidewalk';
    this.hud.setMode(roadish ? t('tools.roadHint') : t('tools.placeHint'), !def.noRotate && def.size[0] !== def.size[1], null);
    this.refreshUi();
  }

  setTool(tool: Tool | null): void {
    if (this.social.visiting) return;
    if (tool === null || this.tool === tool) return this.cancelMode();
    this.tool = tool;
    this.scene.setMode({ kind: 'tool', tool });
    this.hud.setMode(t(`tools.${tool}Hint`), false, tool);
    this.audio.play('click');
  }

  cancelMode(): void {
    this.tool = null;
    this.scene?.setMode({ kind: 'normal' });
    this.hud?.setMode(null, false, null);
    this.refreshUi();
  }

  rotateGhost(): void {
    this.scene.rotateGhost();
    this.audio.play('whoosh');
  }

  startExpand(): void {
    if (this.social.visiting) return;
    this.tool = null;
    this.scene.setMode({ kind: 'expand' });
    this.hud.setMode(t('tools.expandHint'), false, null);
  }

  zoom(f: number): void {
    this.scene.zoomBy(f);
  }

  // ----------------------------------------------------------------- panels

  openBuild(cat?: string, highlight?: string): void {
    if (this.social.visiting) return;
    this.cancelMode();
    openBuildMenu(this, cat, highlight);
    this.refreshUi();
  }

  openGoal(id: string): void {
    openGoalDialog(this, id);
  }

  openCollections(): void {
    openCollections(this);
  }

  openInventory(): void {
    openInventory(this);
  }

  openSettings(): void {
    openSettings(this, VERSION);
  }

  openDaily(): void {
    openDaily(this, this.tz);
  }

  openGifts(): void {
    openGifts(this, (id) => this.social.acceptHelp(id));
  }

  openNeighbors(): void {
    this.social.openNeighbors();
  }

  openAccount(): void {
    this.social.openAccount();
  }

  visit(key: string): void {
    this.cancelMode();
    this.social.visit(key);
  }

  endVisit(): void {
    this.social.endVisit();
  }

  neighbors(): Neighbor[] {
    return this.social.neighbors();
  }

  online(): boolean {
    return this.social.isOnline;
  }

  requestJob(objectId: number, item: string): void {
    void this.social.online.requestJob(objectId, item);
  }

  showHint(target: string | null): void {
    this.hints.enabled = this.prefs.hints;
    this.hints.force(target);
    if (target?.startsWith('build:') && !isBuildOpen()) {
      // nothing else: the arrow points at the Build button
    }
    this.refreshUi();
    setTimeout(() => this.hints.force(null), 8000);
  }

  private locateHint(target: string): { x: number; y: number } | null {
    const [kind, ...rest] = target.split(':');
    const arg = rest.join(':');
    if (kind === 'build') {
      if (isBuildOpen()) {
        const card = document.querySelector(`.card[data-item="${arg}"]`) ?? document.querySelector(`.tab[data-cat="${maybeItem(arg)?.category}"]`);
        if (card) {
          const r = card.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + 10 };
        }
        return null;
      }
      if (anyDialogOpen()) return null;
      if (this.scene.getMode().kind === 'place') return null;
      const b = this.hud.target('build');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 4 };
    }
    if (kind === 'ui') {
      if (anyDialogOpen()) return null;
      const node =
        arg === 'bonus'
          ? this.bonusBar.node.classList.contains('hidden')
            ? null
            : this.bonusBar.node
          : arg === 'collections'
            ? this.hud.target('collectible')
            : ['daily', 'expand', 'gifts'].includes(arg)
              ? document.querySelector('[aria-label="' + t('tools.' + arg) + '"]')
              : null;
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 4 };
    }
    if (kind === 'object') {
      if (anyDialogOpen() || this.scene.getMode().kind !== 'normal') return null;
      const now = this.now();
      const want = arg.startsWith('kind:') ? { kind: arg.slice(5) } : { item: arg };
      const goal = this.state.goals.active.map((g) => g.id).find((id) => id.startsWith('tut_'));
      const found = this.scene.findObjectCss((o) => {
        const def = maybeItem(o.item);
        if (!def) return false;
        if ('item' in want ? o.item !== want.item : def.kind !== want.kind) return false;
        // prefer actionable objects
        if (def.kind === 'house') return (o.readyAt ?? 0) <= now;
        if (def.kind === 'plot') {
          const st = cropStage(this.state, o, now);
          if (goal === 'tut_plant') return !o.crop;
          return st === 'ripe' || (!o.crop && goal !== 'tut_harvest' && goal !== 'tut_berries');
        }
        if (def.kind === 'business') return o.built && o.shop?.state !== 'open';
        return true;
      });
      if (!found) return null;
      // Pan to targets hidden under the HUD (once per goal so we never fight the player).
      const key = goal ?? target;
      const unsafe = found.x < 110 || found.y < 170 || found.x > window.innerWidth - 110 || found.y > window.innerHeight - 160;
      if (unsafe && !this.revealed.has(key)) {
        this.revealed.add(key);
        const o = this.state.objects[found.id];
        if (o) this.scene.centerOnObject(o.id);
      }
      return { x: found.x, y: found.y - 16 };
    }
    return null;
  }

  // ----------------------------------------------------------- preferences

  savePrefs(): void {
    savePrefs(this.prefs);
  }

  applyPrefs(): void {
    this.audio.setSound(this.prefs.sound);
    this.audio.setMusic(this.prefs.music);
    this.audio.setVolume(this.prefs.volume);
    document.documentElement.classList.toggle('cb', this.prefs.colorblind);
    document.documentElement.classList.toggle('rm', this.prefs.reducedMotion);
    if (this.scene) {
      this.scene.colorblind = this.prefs.colorblind;
      this.scene.setReducedMotion(this.prefs.reducedMotion);
      this.scene.setDayNight(this.prefs.dayNight);
      this.scene.setSharpZoom(this.prefs.highRes);
    }
    if (this.hints) this.hints.enabled = this.prefs.hints;
  }

  // ------------------------------------------------------------------ saves

  saveNow(): void {
    if (this.asleep) return;
    if (writeLocalSave(this.state, this.now())) this.dirty = false;
    this.social.cloudSave(this.state);
  }

  /** Another tab took over this city: stop saving here and offer to come back. */
  sleep(): void {
    if (this.asleep) return;
    this.asleep = true;
    openDialog({
      title: t('tabs.title'),
      icon: 'warning',
      dismissable: false,
      body: el('p', { text: t('tabs.text') }),
      actions: [{ label: t('tabs.here'), onClick: () => location.reload() }],
    });
  }

  exportSave(): void {
    downloadSave(this.state, this.now());
    toast(t('msg.exported'), 'good', 'store');
  }

  importSave(): void {
    pickSaveFile(this.now())
      .then((s) => {
        confirmDialog(t('settings.import'), t('import.confirm', { city: s.cityName, level: s.level }), t('dlg.yes'), () => this.replaceState(s));
      })
      .catch((e) => toast(e instanceof SaveError && e.code === 'newer' ? t('msg.importNewer') : t('msg.importFailed'), 'bad'));
  }

  replaceState(s: GameState): void {
    for (const k of PENDING_KINDS) this.pending[k] = 0;
    this.scene.collectAllDoobers();
    this.state = advance(s, this.now());
    this.index = new WorldIndex(this.state);
    this.saveNow();
    this.pushScene(true);
    this.scene.focusDefault();
    this.refreshUi();
    toast(t('msg.imported'), 'good');
  }

  resetGame(): void {
    clearLocalSave();
    const s = createNewGame(this.now());
    this.replaceState(s);
    this.start(true);
  }

  /** Small helper for social/visit code to show an inline dialog. */
  info(title: string, text: string): void {
    openDialog({ title, body: el('p', { text }), actions: [{ label: t('dlg.ok'), onClick: () => {} }] });
  }

  npcLabel(id: string): string {
    return npcName(id);
  }

  whoName(from: string): string {
    return this.social.whoName(from);
  }

  whoIcon(from: string): string {
    if (from.startsWith('npc:')) return from.slice(4);
    return from.startsWith('user:') ? this.social.online.avatarOf(from) : 'gift';
  }
}
