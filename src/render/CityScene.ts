// The isometric world: ground lots, roads, buildings, crops, overlays, walkers,
// vehicles, doobers and the placement ghost. It renders whatever GameState the
// controller hands it (your city or a neighbor snapshot) and reports input.
import Phaser from 'phaser';
import type { SpriteBank } from '../art/atlas';
import { LAWN_VARIANTS, SEA_VARIANTS, WILD_VARIANTS } from '../art/index';
import { content, maybeItem } from '../sim/content';
import { cropStage } from '../sim/economy';
import { hash2 } from '../sim/rng';
import { checkPlacement, dims, expandableLots, isSeaLot, lotInBounds, parseLot, rectOf, roadMask, WorldIndex } from '../sim/world';
import type { Drop, GameState, Rot, WorldObject } from '../sim/types';
import { daylight, daylightAt, mulColor, type DayNightMode } from './daylight';
import { Doobers } from './doobers';
import { Extras } from './extras';
import { Fx } from './fx';
import { Ghost } from './ghost';
import { isoToWorld, Sprites, worldToIso } from './sprites';
import { Vehicles } from './vehicles';
import { Walkers } from './walkers';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'place'; item: string; rot: Rot; fromInventory: boolean; moveId?: number }
  | { kind: 'tool'; tool: 'move' | 'rotate' | 'store' | 'sell' }
  | { kind: 'expand' }
  | { kind: 'visit' };

export interface SceneSource {
  /** Identifies whose city this is ('home', 'npc:pip', 'user:12'...). */
  key: string;
  state: GameState;
  index: WorldIndex;
  visiting: boolean;
  /** Objects to highlight with the blue "neighbor helped" glow. */
  glow: Set<number>;
  /** Helper avatars to draw over objects (objectId -> portrait key). */
  helpers: Map<number, string>;
  /** Objects that can still be helped (visit mode) */
  helpable: Set<number>;
  /** Franchise shops standing (or waiting) on Empty Lots, by lot id. */
  franchises?: Map<number, { item: string; pending: boolean; goods: number; ownerAvatar: string }>;
}

export interface SceneEvents {
  tapObject(id: number): void;
  tapTile(x: number, y: number): void;
  place(x: number, y: number, rot: Rot): boolean;
  hover(id: number | null, cssX: number, cssY: number): void;
  pickup(d: Drop, cssX: number, cssY: number): void;
  tapHelper(objectId: number): void;
  tapLot(lx: number, ly: number): void;
}

interface View {
  id: number;
  img: Phaser.GameObjects.Image;
  key: string;
  flip: boolean;
  flat: boolean;
  /** Lit windows / lamps drawn over the building at night. */
  lit: Phaser.GameObjects.Image | null;
  litKey: string;
  /** Tint before the time of day is multiplied in (special decorations glow a little). */
  baseTint: number;
  moving: boolean;
  overlay: Phaser.GameObjects.Image | null;
  overlayKey: string;
  glow: Phaser.GameObjects.Image | null;
  helper: Phaser.GameObjects.Image | null;
  helperKey: string;
  bounds: { x: number; y: number; w: number; h: number };
  sig: string;
  cx: number;
  cy: number;
}

const GROUND_DEPTH = -3_000_000;
const FLAT_DEPTH = -2_000_000;
const OVERLAY_DEPTH = 5_000_000;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.2;

export class CityScene extends Phaser.Scene {
  sprites!: Sprites;
  fx!: Fx;
  doobers!: Doobers;
  walkers!: Walkers;
  vehicles!: Vehicles;
  ghost!: Ghost;
  extras!: Extras;
  private expandG!: Phaser.GameObjects.Graphics;
  private src!: SceneSource;
  private events_!: SceneEvents;
  private views = new Map<number, View>();
  private ground: Phaser.GameObjects.Image[] = [];
  private signs: { img: Phaser.GameObjects.Image; lx: number; ly: number }[] = [];
  private mode: Mode = { kind: 'normal' };
  private zoomLevel = 1;
  private center = { x: 0, y: 0 };
  private dpr = 1;
  private bounds = { x0: -2000, y0: -500, x1: 2000, y1: 2500 };
  private drag = { down: false, moved: false, sx: 0, sy: 0, cx: 0, cy: 0, painting: false, pointerId: -1 };
  private pinch: { dist: number; zoom: number } | null = null;
  private hoverAt = 0;
  private hoverId: number | null = null;
  private lastGhost = { x: Number.NaN, y: Number.NaN };
  private ghostRot: Rot = 0;
  private dirtyCull = true;
  private lastStateSig = '';
  private reducedMotion = false;
  colorblind = false;
  private textRes = 1;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  // time of day
  private dayMode: DayNightMode = 'clock';
  private dayPreview: number | null = null;
  private dayTint = 0xffffff;
  private night = 0;
  private dayClock = 0;
  private readonly tz = new Date().getTimezoneOffset();
  /** Per tile: depth range that keeps a mover in front of / behind nearby buildings. */
  private depthLimits = new Map<number, [number, number]>();
  // sharp zoom: redraw on-screen sprites once the zoom settles
  private zz = 0;
  private zzAt = 0;
  private zzApplied = -1;
  private sharpClock = 0;

  constructor(private bank: SpriteBank, private onReady: (scene: CityScene) => void) {
    super({ key: 'city' });
  }

  create(): void {
    this.dpr = this.game.registry.get('dpr') ?? 1;
    this.textRes = Math.max(1, this.dpr);
    this.sprites = new Sprites(this, this.bank);
    this.sprites.upload(this.bank.pack('atlas'));
    this.fx = new Fx(this, this.sprites, this.textRes);
    this.doobers = new Doobers(this, this.sprites, (d, wx, wy) => {
      const [cx, cy] = this.worldToCss(wx, wy);
      this.events_?.pickup(d, cx, cy);
    });
    const index = new WorldIndex({ objects: {}, lots: [] } as unknown as GameState);
    this.walkers = new Walkers(this, this.sprites, index);
    this.vehicles = new Vehicles(this, this.sprites, index);
    const depthAt = (x: number, y: number, bias: number) => this.moverDepth(x, y, bias);
    this.walkers.depthAt = depthAt;
    this.vehicles.depthAt = depthAt;
    this.ghost = new Ghost(this, this.sprites, this.textRes);
    this.extras = new Extras(this, this.sprites);
    this.expandG = this.add.graphics().setDepth(7_900_000);
    this.input.addPointer(2);
    this.setupInput();
    this.scale.on('resize', () => {
      this.applyCamera();
      this.dirtyCull = true;
    });
    this.updateDaylight(true);
    this.onReady(this);
  }

  // ------------------------------------------------------------- public API

  attach(src: SceneSource, events: SceneEvents, structural = false): void {
    const first = !this.src;
    const switched = !!this.src && this.src.key !== src.key;
    this.src = src;
    this.events_ = events;
    if (first || switched) {
      for (const v of this.views.values()) this.destroyView(v);
      this.views.clear();
      this.depthLimits.clear();
      this.walkers.clear();
      this.vehicles.clear();
      this.extras.clear();
      this.doobers.collectAll();
    }
    this.sync(first || switched || structural);
    if (first || switched) this.focusDefault();
  }

  setMode(m: Mode): void {
    this.mode = m;
    if (m.kind === 'place') this.ghostRot = m.rot;
    else this.ghost.hide();
    this.lastGhost = { x: Number.NaN, y: Number.NaN };
    this.refreshSigns();
    this.sync(false);
    this.updateGhostFromPointer();
  }

  getMode(): Mode {
    return this.mode;
  }

  rotateGhost(): void {
    if (this.mode.kind !== 'place') return;
    const def = maybeItem(this.mode.item);
    if (def?.noRotate) return;
    this.ghostRot = this.ghostRot === 0 ? 1 : 0;
    this.mode = { ...this.mode, rot: this.ghostRot };
    this.lastGhost = { x: Number.NaN, y: Number.NaN };
    this.updateGhostFromPointer();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.fx.reducedMotion = on;
    this.doobers.reducedMotion = on;
    this.extras.reducedMotion = on;
  }

  /** The "Day and night" setting. */
  setDayNight(mode: DayNightMode): void {
    this.dayMode = mode;
    this.updateDaylight(true);
  }

  /** Shows a fixed hour (0-24) instead of the setting; null returns to normal. Dev preview. */
  previewHour(hour: number | null): void {
    this.dayPreview = hour;
    this.updateDaylight(true);
  }

  /** Uploads art drawn after start-up (night layers) and shows it on existing objects. */
  addArt(pages: ReturnType<SpriteBank['pack']>): void {
    this.sprites.upload(pages);
    for (const v of this.views.values()) v.sig = '';
    this.sync(false);
  }

  /** The "Sharp zoom" setting: redraw on-screen art at the zoom's resolution. */
  setSharpZoom(on: boolean): void {
    this.sprites.sharpEnabled = on;
    this.zzApplied = -1;
  }

  setQuality(maxWalkers: number, cars: number): void {
    this.walkers.max = maxWalkers;
    this.vehicles.ambientMax = cars;
  }

  setShopRates(residents: number, tourists: number): void {
    this.walkers.rates = { residents, tourists };
  }

  zoomBy(f: number, cssX?: number, cssY?: number): void {
    const z = Phaser.Math.Clamp(this.zoomLevel * f, MIN_ZOOM, MAX_ZOOM);
    const cam = this.cameras.main;
    const px = (cssX ?? cam.width / this.dpr / 2) * this.dpr;
    const py = (cssY ?? cam.height / this.dpr / 2) * this.dpr;
    const before = this.screenToWorld(px, py);
    this.zoomLevel = z;
    const zz = z * this.dpr;
    this.center.x = before.x - (px - cam.width / 2) / zz;
    this.center.y = before.y - (py - cam.height / 2) / zz;
    this.applyCamera();
  }

  panBy(dxCss: number, dyCss: number): void {
    const zz = this.zoomLevel * this.dpr;
    this.center.x += (dxCss * this.dpr) / zz;
    this.center.y += (dyCss * this.dpr) / zz;
    this.applyCamera();
  }

  centerOnTile(x: number, y: number): void {
    const [wx, wy] = isoToWorld(x, y);
    this.center = { x: wx, y: wy };
    this.applyCamera();
  }

  /** CSS-pixel screen position of a tile coordinate (for HUD hint arrows). */
  tileToCss(x: number, y: number, lift = 0): [number, number] {
    const [wx, wy] = isoToWorld(x, y);
    return this.worldToCss(wx, wy - lift);
  }

  objectCss(id: number): [number, number] | null {
    const v = this.views.get(id);
    if (!v) return null;
    return this.worldToCss(v.cx, v.bounds.y + Math.min(30, v.bounds.h * 0.4));
  }

  isOnScreen(id: number): boolean {
    const v = this.views.get(id);
    if (!v) return false;
    const view = this.cameras.main.worldView;
    return Phaser.Geom.Rectangle.Overlaps(view, new Phaser.Geom.Rectangle(v.bounds.x, v.bounds.y, v.bounds.w, v.bounds.h));
  }

  spawnDrops(x: number, y: number, drops: Drop[], objId?: number): void {
    let wx: number;
    let wy: number;
    let groundY: number;
    const v = objId !== undefined ? this.views.get(objId) : undefined;
    const o = objId !== undefined ? this.src.state.objects[objId] : undefined;
    if (v && o) {
      const r = rectOf(o);
      wx = v.cx;
      wy = v.cy - Math.min(40, v.bounds.h * 0.35);
      // land on the ground just in front of the footprint so they never cover it
      groundY = isoToWorld(r.x + r.w, r.y + r.h)[1] + 10;
    } else {
      [wx, wy] = isoToWorld(x, y);
      groundY = wy + 14;
    }
    this.doobers.spawn(wx, wy, drops, groundY);
  }

  floatAt(objId: number | null, x: number, y: number, label: string, color?: string): void {
    const v = objId !== null ? this.views.get(objId) : undefined;
    const [wx, wy] = v ? [v.cx, v.bounds.y + 10] : isoToWorld(x, y);
    this.fx.float(wx, wy, label, color);
  }

  puffAt(objId: number, color?: number): void {
    const v = this.views.get(objId);
    if (v) this.fx.puff(v.cx, v.cy - 6, color);
  }

  bounce(objId: number): void {
    const v = this.views.get(objId);
    if (!v || this.reducedMotion) return;
    for (const img of v.lit ? [v.img, v.lit] : [v.img]) {
      this.tweens.killTweensOf(img);
      const s = img.scaleX;
      img.setScale(s, s);
      this.tweens.add({ targets: img, scaleY: s * 1.06, duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => img.setScale(img.scaleX, img.scaleX) });
    }
  }

  moveInVan(objId: number, pop: number): void {
    const v = this.views.get(objId);
    const o = this.src.state.objects[objId];
    if (!o || !v) return;
    const sent = this.vehicles.sendTo(o, 'van', (at) => {
      this.walkers.moveIn([at[0] + 1, at[1] + 1], o, this.src.index);
      this.fx.float(v.cx, v.bounds.y + 6, `+${pop}`, '#9fe870');
    });
    if (!sent) this.fx.float(v.cx, v.bounds.y + 6, `+${pop}`, '#9fe870');
  }

  tourBus(objId: number): void {
    const o = this.src.state.objects[objId];
    if (o) this.vehicles.sendTo(o, 'bus');
  }

  collectAllDoobers(): void {
    this.doobers.collectAll();
  }

  // -------------------------------------------------------------- syncing --

  /** Reconciles sprites with the current state. Cheap to call every tick. */
  sync(full: boolean): void {
    if (!this.src) return;
    const s = this.src.state;
    const index = this.src.index;
    const now = s.now;
    const lotSig = `${this.src.key}|${s.lots.join(';')}`;
    if (lotSig !== this.lastStateSig) {
      this.lastStateSig = lotSig;
      this.buildGround();
    }
    const structural = full;
    if (structural) {
      this.depthLimits.clear();
      this.walkers.refresh(s, index, true);
      this.vehicles.refresh(s, index);
    }
    const seen = new Set<number>();
    for (const k in s.objects) {
      const o = s.objects[k]!;
      seen.add(o.id);
      this.syncObject(o, index, now);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.destroyView(v);
        this.views.delete(id);
      }
    }
    if (!structural) this.walkers.refresh(s, index, false);
    this.extras.sync(s, now, this.src.key === 'home');
    this.refreshSigns();
    this.dirtyCull = true;
  }

  private spriteFor(o: WorldObject, index: WorldIndex, now: number): { key: string; flip: boolean; flat: boolean; shift?: number } {
    const def = maybeItem(o.item);
    if (!def) return { key: 'dot', flip: false, flat: true };
    if (def.kind === 'emptyLot' && o.built) {
      // a franchise stands on the lot: draw that shop, centred on the lot
      const shop = maybeItem(this.src.franchises?.get(o.id)?.item ?? '');
      if (shop) {
        const r = this.sprites.itemKey(shop.art ?? `item.${shop.id}`, 0);
        if (this.sprites.has(r.key)) return { key: r.key, flip: false, flat: false, shift: (def.size[0] - shop.size[0]) / 2 };
      }
    }
    if (def.kind === 'road') return { key: `road.${roadMask(index, o)}`, flip: false, flat: true };
    if (def.kind === 'sidewalk') return { key: 'sidewalk', flip: false, flat: true };
    if (def.kind === 'plot') {
      const st = cropStage(this.src.state, o, now);
      if (!o.crop || !st) return { key: 'plot.empty', flip: false, flat: false };
      if (st === 'withered') return { key: 'crop.withered', flip: false, flat: false };
      const n = st === 'seed' ? 1 : st === 'growing' ? 2 : 3;
      return { key: `crop.${o.crop.id}.${n}`, flip: false, flat: false };
    }
    const total = def.clicks ?? 0;
    if (!o.built && total > 0) {
      const [w, h] = dims(def, o.rot);
      const stage = o.clicks >= total ? 3 : o.clicks < total / 3 ? 1 : o.clicks < (total * 2) / 3 ? 2 : 3;
      return { key: `construct.${w}x${h}.${stage}`, flip: false, flat: false };
    }
    let base = def.art ?? `item.${def.id}`;
    const lvl = o.level ?? 1;
    // upgraded buildings use their level-2/3 artwork when it exists
    if (lvl >= 2 && (this.sprites.has(`${base}.L${lvl}.0`) || this.sprites.has(`${base}.L${lvl}`))) base = `${base}.L${lvl}`;
    const r = this.sprites.itemKey(base, o.rot);
    return { key: this.sprites.has(r.key) ? r.key : 'icon.build', flip: r.flip, flat: false };
  }

  private overlayFor(o: WorldObject, index: WorldIndex, now: number): string {
    const def = maybeItem(o.item);
    if (!def) return '';
    if (def.kind === 'emptyLot' && o.built) {
      const fr = this.src.franchises?.get(o.id);
      // a free lot in a friend's town invites a franchise; at home: requests and deliveries
      if (this.src.visiting) return fr || !this.src.key.startsWith('user:') ? '' : 'icon.franchise';
      if (fr?.pending) return 'icon.franchise';
      return fr && fr.goods > 0 ? 'icon.goods' : '';
    }
    if (this.src.visiting) return this.src.helpable.has(o.id) ? 'icon.helpMark' : '';
    if (def.kind === 'plot') return o.crop && cropStage(this.src.state, o, now) === 'ripe' ? 'icon.ripe' : '';
    if (!o.built) {
      if (def.jobs && o.clicks >= (def.clicks ?? 0) && (o.staff?.length ?? 0) < def.jobs) return 'icon.hardhat';
      if (def.jobs && o.clicks >= (def.clicks ?? 0)) return 'icon.hammer';
      return '';
    }
    if (def.needsRoad && !index.roadAccess(rectOf(o))) return 'icon.noRoad';
    switch (def.kind) {
      case 'house':
        return (o.readyAt ?? 0) <= now ? 'icon.rentReady' : '';
      case 'business':
        if (o.shop?.state === 'opening') return 'icon.balloons';
        if (o.shop?.state === 'empty') return 'icon.needGoods';
        if (o.shop?.state === 'soldout') return 'icon.moneybag';
        return '';
      case 'pier':
        return (o.ships ?? []).some((sh) => sh && now >= sh.startedAt + (content().contracts[sh.contract]?.time ?? 0) * 1000) ? 'icon.shipReady' : '';
      case 'station': {
        if (this.src.state.level < content().balance.train.unlockLevel) return 'icon.lock';
        const tr = this.src.state.train;
        if (tr) {
          const r = content().routes[tr.route];
          if (r && now >= tr.startedAt + r.time * 1000) return 'icon.train';
          return '';
        }
        return 'icon.train';
      }
      case 'wonder':
        return (o.boostReadyAt ?? 0) <= now ? 'icon.wonder' : '';
      default:
        if (def.profit && (o.readyAt ?? 0) <= now) return 'icon.profitReady';
        return '';
    }
  }

  private syncObject(o: WorldObject, index: WorldIndex, now: number): void {
    const { key, flip, flat, shift = 0 } = this.spriteFor(o, index, now);
    const overlayKey = this.overlayFor(o, index, now);
    const def = maybeItem(o.item);
    const glow = this.src.glow.has(o.id);
    const helperKey = this.src.helpers.get(o.id) ?? '';
    const moving = this.mode.kind === 'place' && this.mode.moveId === o.id;
    // a franchise waiting for the host's answer is shown faded
    const faded = moving || (def?.kind === 'emptyLot' && this.src.franchises?.get(o.id)?.pending === true);
    const sig = `${key}|${flip}|${o.x},${o.y}|${overlayKey}|${glow}|${helperKey}|${faded}`;
    let v = this.views.get(o.id);
    if (v && v.sig === sig) return;
    if (!v) {
      const img = this.add.image(0, 0, '__WHITE');
      v = { id: o.id, img, key: '', flip: false, flat, lit: null, litKey: '', baseTint: 0xffffff, moving: false, overlay: null, overlayKey: '', glow: null, helper: null, helperKey: '', bounds: { x: 0, y: 0, w: 0, h: 0 }, sig: '', cx: 0, cy: 0 };
      this.views.set(o.id, v);
    }
    v.sig = sig;
    v.flat = flat;
    if (v.key !== key || v.flip !== flip) {
      this.sprites.apply(v.img, key, flip);
      v.key = key;
      v.flip = flip;
    }
    const [wx, wy] = isoToWorld(o.x + shift, o.y + shift);
    v.img.setPosition(wx, wy);
    const r = rectOf(o);
    const ccx = r.x + r.w / 2;
    const ccy = r.y + r.h / 2;
    const [cwx, cwy] = isoToWorld(ccx, ccy);
    v.cx = cwx;
    v.cy = cwy;
    v.img.setDepth(flat ? FLAT_DEPTH + (ccx + ccy) : (ccx + ccy) * 10);
    v.img.setAlpha(moving ? 0.25 : faded ? 0.55 : 1);
    v.moving = faded;
    v.bounds = this.sprites.bounds(v.img, key);
    v.baseTint = def?.kind === 'decoration' && def.bonus && def.bonus >= 30 ? 0xfff6d0 : 0xffffff;
    this.tintView(v);
    // lit windows and lamps for the night, drawn right over the sprite
    const litKey = `${key}.lit`;
    if (this.sprites.has(litKey)) {
      if (!v.lit) v.lit = this.add.image(0, 0, '__WHITE');
      if (v.litKey !== litKey || v.lit.flipX !== flip) {
        this.sprites.apply(v.lit, litKey, flip);
        v.litKey = litKey;
      }
      v.lit.setPosition(wx, wy).setDepth(v.img.depth + 0.002);
      this.litView(v);
    } else if (v.lit) {
      v.lit.destroy();
      v.lit = null;
      v.litKey = '';
    }

    // state overlay icon
    if (overlayKey) {
      if (!v.overlay) v.overlay = this.add.image(0, 0, '__WHITE');
      if (v.overlayKey !== overlayKey) {
        this.sprites.apply(v.overlay, overlayKey);
        const big = overlayKey === 'icon.balloons';
        v.overlay.setScale(v.overlay.scaleX * (big ? 0.9 : overlayKey === 'icon.ripe' ? 0.42 : 0.62));
        v.overlayKey = overlayKey;
      }
      v.overlay.setPosition(cwx + (overlayKey === 'icon.balloons' ? 18 : 0), Math.max(v.bounds.y + 8, cwy - 80)).setDepth(OVERLAY_DEPTH + cwy).setVisible(true);
      v.overlay.setData('baseY', v.overlay.y);
    } else if (v.overlay) {
      const old = v.overlay;
      if (v.overlayKey === 'icon.balloons' && !this.reducedMotion) {
        // grand opening: the balloons float away on the first delivery
        this.tweens.add({ targets: old, y: old.y - 140, x: old.x + 30, alpha: 0, duration: 1600, ease: 'Sine.In', onComplete: () => old.destroy() });
      } else {
        old.destroy();
      }
      v.overlay = null;
      v.overlayKey = '';
    }
    // neighbor-help glow
    if (glow) {
      if (!v.glow) {
        v.glow = this.add.image(0, 0, '__WHITE');
        this.sprites.apply(v.glow, 'glow.blue');
        v.glow.setOrigin(0.5, 0.5);
      }
      this.sprites.scaleTo(v.glow, Math.max(r.w, r.h) * 0.85);
      v.glow.setPosition(cwx, cwy).setDepth(v.img.depth - 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(true);
    } else if (v.glow) {
      v.glow.destroy();
      v.glow = null;
    }
    // helper avatar (pending neighbor help)
    if (helperKey) {
      if (!v.helper) v.helper = this.add.image(0, 0, '__WHITE');
      if (v.helperKey !== helperKey) {
        this.sprites.apply(v.helper, `icon.${helperKey}`);
        v.helper.setScale(v.helper.scaleX * 0.7);
        v.helperKey = helperKey;
      }
      v.helper.setPosition(cwx - 22, Math.max(v.bounds.y + 4, cwy - 86)).setDepth(OVERLAY_DEPTH + cwy + 1).setVisible(true);
      v.helper.setData('baseY', v.helper.y);
    } else if (v.helper) {
      v.helper.destroy();
      v.helper = null;
      v.helperKey = '';
    }
  }

  private destroyView(v: View): void {
    v.img.destroy();
    v.lit?.destroy();
    v.overlay?.destroy();
    v.glow?.destroy();
    v.helper?.destroy();
  }

  // --------------------------------------------------------------- ground --

  private buildGround(): void {
    for (const g of this.ground) g.destroy();
    this.ground = [];
    const s = this.src.state;
    const owned = new Set(s.lots);
    let minX = 0, maxX = 2, minY = 0, maxY = 2;
    for (const key of s.lots) {
      const [lx, ly] = parseLot(key);
      minX = Math.min(minX, lx);
      maxX = Math.max(maxX, lx);
      minY = Math.min(minY, ly);
      maxY = Math.max(maxY, ly);
    }
    const pad = 3;
    const sea = content().balance.world.seaFromLotY;
    for (let lx = minX - pad; lx <= maxX + pad; lx++) {
      for (let ly = minY - pad; ly <= Math.max(maxY + pad, sea + 2); ly++) {
        let key: string;
        const v = Math.floor(hash2(lx, ly, 7) * 100);
        if (isSeaLot(ly)) key = ly === sea ? `lot.shore.${v % SEA_VARIANTS}` : `lot.sea.${v % SEA_VARIANTS}`;
        else if (owned.has(`${lx},${ly}`)) key = `lot.lawn.${v % LAWN_VARIANTS}`;
        else key = `lot.wild.${v % WILD_VARIANTS}`;
        const img = this.add.image(0, 0, '__WHITE');
        this.sprites.apply(img, key);
        const [wx, wy] = isoToWorld(lx * 12, ly * 12);
        img.setPosition(wx, wy).setDepth(GROUND_DEPTH + (lx + ly) + (owned.has(`${lx},${ly}`) ? 0.5 : 0));
        // land beyond the map edge is faded out
        img.setData('tint', !lotInBounds(lx, ly) && !isSeaLot(ly) ? 0xb8c9a8 : 0xffffff);
        this.tintPlain(img);
        this.ground.push(img);
      }
    }
    if (this.src.key === 'home') {
      const w = content().balance.world;
      for (let y = (minY - pad) * 12; y < sea * 12; y += 3) {
        const img = this.add.image(0, 0, '__WHITE');
        this.sprites.apply(img, 'rail');
        const [rx, ry] = isoToWorld(w.railX, y);
        img.setPosition(rx, ry).setDepth(FLAT_DEPTH - 10 + (w.railX + y) * 0.001);
        this.tintPlain(img);
        this.ground.push(img);
      }
    }
    // camera bounds: the owned area plus a margin
    const [ax] = isoToWorld(minX * 12, (maxY + 1) * 12);
    const [bx] = isoToWorld((maxX + 1) * 12, minY * 12);
    const [, ay] = isoToWorld(minX * 12, minY * 12);
    const [, by] = isoToWorld((maxX + 1) * 12, (maxY + 1) * 12);
    this.bounds = { x0: ax - 200, x1: bx + 200, y0: ay - 250, y1: by + 250 };
    this.applyCamera();
  }

  private refreshSigns(): void {
    if (!this.src) return;
    const want = this.src.visiting ? [] : expandableLots(this.src.state);
    const expand = this.mode.kind === 'expand';
    const key = want.map(([x, y]) => `${x},${y}`).join(';') + expand;
    if (this.signs.length && (this.signs as unknown as { _k?: string })._k === key) return;
    for (const s of this.signs) s.img.destroy();
    this.signs = [];
    for (const [lx, ly] of want) {
      const img = this.add.image(0, 0, '__WHITE');
      this.sprites.apply(img, 'sign.sale');
      const [wx, wy] = isoToWorld(lx * 12 + 6, ly * 12 + 6);
      img.setPosition(wx, wy).setDepth((lx * 12 + 6 + ly * 12 + 6) * 10 + 1);
      if (expand) img.setScale(img.scaleX * 1.6);
      else img.setAlpha(0.85);
      this.tintPlain(img);
      this.signs.push({ img, lx, ly });
    }
    (this.signs as unknown as { _k?: string })._k = key;
    this.expandG.clear();
    if (expand) {
      for (const [lx, ly] of want) {
        const pts = [isoToWorld(lx * 12, ly * 12), isoToWorld(lx * 12 + 12, ly * 12), isoToWorld(lx * 12 + 12, ly * 12 + 12), isoToWorld(lx * 12, ly * 12 + 12)].map(([px, py]) => new Phaser.Math.Vector2(px, py));
        this.expandG.fillStyle(0xffd23f, 0.12).fillPoints(pts, true);
        this.expandG.lineStyle(3, 0xf2b705, 0.9).strokePoints(pts, true);
      }
    }
  }

  focusDefault(): void {
    const s = this.src.state;
    // Centre on the town hall / densest area: average of building centres.
    let sx = 0, sy = 0, n = 0;
    for (const k in s.objects) {
      const o = s.objects[k]!;
      const def = maybeItem(o.item);
      if (!def || def.kind === 'road' || def.kind === 'decoration' || def.kind === 'station') continue;
      const r = rectOf(o);
      sx += r.x + r.w / 2;
      sy += r.y + r.h / 2;
      n++;
    }
    if (n === 0) {
      sx = 18;
      sy = 18;
      n = 1;
    }
    // Fit roughly 28 tiles across on small screens, never closer than 1:1.
    this.zoomLevel = Phaser.Math.Clamp(Math.min(window.innerWidth / 1500, window.innerHeight / 900), 0.45, 1);
    this.centerOnTile(sx / n, sy / n);
  }

  // --------------------------------------------------------------- camera --

  private applyCamera(): void {
    const cam = this.cameras.main;
    const zz = this.zoomLevel * this.dpr;
    const halfW = cam.width / zz / 2;
    const halfH = cam.height / zz / 2;
    const b = this.bounds;
    this.center.x = b.x1 - b.x0 < halfW * 2 ? (b.x0 + b.x1) / 2 : Phaser.Math.Clamp(this.center.x, b.x0 + halfW * 0.6, b.x1 - halfW * 0.6);
    this.center.y = b.y1 - b.y0 < halfH * 2 ? (b.y0 + b.y1) / 2 : Phaser.Math.Clamp(this.center.y, b.y0 + halfH * 0.6, b.y1 - halfH * 0.6);
    cam.setZoom(zz);
    cam.centerOn(this.center.x, this.center.y);
    this.dirtyCull = true;
  }

  private screenToWorld(px: number, py: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const zz = this.zoomLevel * this.dpr;
    return { x: this.center.x + (px - cam.width / 2) / zz, y: this.center.y + (py - cam.height / 2) / zz };
  }

  private worldToCss(wx: number, wy: number): [number, number] {
    const cam = this.cameras.main;
    const zz = this.zoomLevel * this.dpr;
    const px = (wx - this.center.x) * zz + cam.width / 2;
    const py = (wy - this.center.y) * zz + cam.height / 2;
    return [px / this.dpr, py / this.dpr];
  }

  // ---------------------------------------------------------------- input --

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      for (const k of ['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D']) this.keys[k] = kb.addKey(k, false);
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 1 / 1.12 : 1.12, p.x / this.dpr, p.y / this.dpr);
    });
    this.input.on('gameout', () => this.events_?.hover(null, 0, 0));
  }

  private activePointers(): Phaser.Input.Pointer[] {
    return this.input.manager.pointers.filter((p) => p.isDown);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const downs = this.activePointers();
    if (downs.length >= 2) {
      const [a, b] = downs as [Phaser.Input.Pointer, Phaser.Input.Pointer];
      this.pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.zoomLevel };
      this.drag.down = false;
      return;
    }
    this.drag = { down: true, moved: false, sx: p.x, sy: p.y, cx: this.center.x, cy: this.center.y, painting: false, pointerId: p.id };
    // Mouse drag-paints roads/sidewalks/plots/decor in placement mode.
    if (this.mode.kind === 'place' && p.wasTouch === false && p.button === 0) {
      const def = maybeItem(this.mode.item);
      if (def && (def.kind === 'road' || def.kind === 'sidewalk') && !this.mode.moveId) {
        this.drag.painting = true;
        this.tryPlaceAtPointer(p);
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.pinch) {
      const downs = this.activePointers();
      if (downs.length >= 2) {
        const [a, b] = downs as [Phaser.Input.Pointer, Phaser.Input.Pointer];
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const midX = (a.x + b.x) / 2 / this.dpr;
        const midY = (a.y + b.y) / 2 / this.dpr;
        const target = Phaser.Math.Clamp(this.pinch.zoom * (d / Math.max(1, this.pinch.dist)), MIN_ZOOM, MAX_ZOOM);
        this.zoomBy(target / this.zoomLevel, midX, midY);
      }
      return;
    }
    if (this.drag.down && p.id === this.drag.pointerId) {
      const dx = p.x - this.drag.sx;
      const dy = p.y - this.drag.sy;
      if (this.drag.painting) {
        this.tryPlaceAtPointer(p);
        this.updateGhost(p.x, p.y);
        return;
      }
      if (!this.drag.moved && Math.hypot(dx, dy) > 8 * this.dpr) this.drag.moved = true;
      if (this.drag.moved) {
        const zz = this.zoomLevel * this.dpr;
        this.center.x = this.drag.cx - dx / zz;
        this.center.y = this.drag.cy - dy / zz;
        this.applyCamera();
        this.events_?.hover(null, 0, 0);
        return;
      }
    }
    // hover: doobers first, then tooltips
    const w = this.screenToWorld(p.x, p.y);
    if (!p.wasTouch) this.doobers.collectNear(w.x, w.y, 22);
    this.updateGhost(p.x, p.y);
    const t = this.time.now;
    if (t - this.hoverAt > 60 && !p.wasTouch) {
      this.hoverAt = t;
      const id = this.mode.kind === 'place' ? null : this.pick(w.x, w.y);
      if (id !== this.hoverId) this.setHover(id);
      this.events_?.hover(id, p.x / this.dpr, p.y / this.dpr);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pinch) {
      if (this.activePointers().length < 2) this.pinch = null;
      this.drag.down = false;
      return;
    }
    if (!this.drag.down || p.id !== this.drag.pointerId) return;
    const wasDrag = this.drag.moved || this.drag.painting;
    this.drag.down = false;
    if (wasDrag) return;
    const w = this.screenToWorld(p.x, p.y);
    if (this.doobers.collectNear(w.x, w.y, p.wasTouch ? 34 : 24) > 0) return;
    this.tap(w.x, w.y, p);
  }

  private tap(wx: number, wy: number, p: Phaser.Input.Pointer): void {
    if (!this.src || !this.events_) return;
    // helper avatars first
    for (const v of this.views.values()) {
      if (v.helper && Math.hypot(v.helper.x - wx, v.helper.y - wy) < 22) {
        this.events_.tapHelper(v.id);
        return;
      }
    }
    if (this.mode.kind === 'place') {
      this.updateGhost(p.x, p.y);
      this.tryPlaceAtPointer(p);
      return;
    }
    if (this.mode.kind === 'expand') {
      const [tx, ty] = worldToIso(wx, wy);
      this.events_.tapLot(Math.floor(tx / 12), Math.floor(ty / 12));
      return;
    }
    const id = this.pick(wx, wy);
    if (id !== null) {
      this.events_.tapObject(id);
      return;
    }
    const [tx, ty] = worldToIso(wx, wy);
    // tapping a sale sign
    for (const s of this.signs) {
      if (Math.floor(tx / 12) === s.lx && Math.floor(ty / 12) === s.ly && Math.hypot(s.img.x - wx, s.img.y - 20 - wy) < 50) {
        this.events_.tapLot(s.lx, s.ly);
        return;
      }
    }
    this.events_.tapTile(Math.floor(tx), Math.floor(ty));
  }

  /** Topmost object under a world point (pixel-accurate for tall sprites). */
  pick(wx: number, wy: number): number | null {
    let best: View | null = null;
    for (const v of this.views.values()) {
      if (v.flat || !v.img.visible) continue;
      const b = v.bounds;
      if (wx < b.x || wy < b.y || wx > b.x + b.w || wy > b.y + b.h) continue;
      if (best && v.img.depth <= best.img.depth) continue;
      if (this.sprites.hit(v.img, v.key, wx, wy)) best = v;
    }
    if (best) return best.id;
    const [tx, ty] = worldToIso(wx, wy);
    const o = this.src.index.at(Math.floor(tx), Math.floor(ty));
    return o ? o.id : null;
  }

  private setHover(id: number | null): void {
    const prev = this.hoverId !== null ? this.views.get(this.hoverId) : undefined;
    this.hoverId = id;
    if (prev) this.tintView(prev);
    const v = id !== null ? this.views.get(id) : undefined;
    if (v) this.tintView(v);
  }

  // ---------------------------------------------------------- time of day --

  /** A view's own tint (hover highlight, glowing decorations) times the sky colour. */
  private tintView(v: View): void {
    const own = this.hoverId === v.id && !v.flat ? 0xfff3d0 : v.baseTint;
    const t = mulColor(own, this.dayTint);
    if (t === 0xffffff) v.img.clearTint();
    else v.img.setTint(t);
  }

  private litView(v: View): void {
    if (!v.lit) return;
    v.lit.setAlpha(this.night * (v.moving ? 0.25 : 1)).setVisible(v.img.visible && this.night > 0.01);
  }

  /** Tints an image by the sky colour (times its own 'tint' data, if any). */
  private tintPlain(img: Phaser.GameObjects.Image): void {
    const own = (img.getData('tint') as number | undefined) ?? 0xffffff;
    const t = mulColor(own, this.dayTint);
    if (t === 0xffffff) img.clearTint();
    else img.setTint(t);
  }

  private updateDaylight(force: boolean): void {
    const d = this.dayPreview !== null ? daylightAt(this.dayPreview) : daylight(this.dayMode, Date.now(), this.tz);
    if (!force && d.tint === this.dayTint && Math.abs(d.night - this.night) < 0.004) return;
    this.dayTint = d.tint;
    this.night = d.night;
    for (const v of this.views.values()) {
      this.tintView(v);
      this.litView(v);
    }
    for (const g of this.ground) this.tintPlain(g);
    for (const s of this.signs) this.tintPlain(s.img);
    this.walkers.tint = d.tint;
    this.walkers.night = d.night;
    this.vehicles.tint = d.tint;
    this.vehicles.night = d.night;
    this.extras.setDaylight(d.tint, d.night);
  }

  // --------------------------------------------------------- mover depth --

  /**
   * Depth for a small sprite moving at tile (x, y): above the buildings it is
   * in front of and below the ones it is behind. Plain (x + y) sorting gets
   * this wrong next to wide buildings, which made cars and people flicker in
   * and out behind walls as they walked past.
   */
  moverDepth(x: number, y: number, bias: number): number {
    const natural = (x + y) * 10 + bias;
    if (!this.src) return natural;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const k = (tx + 2048) * 4096 + (ty + 2048);
    let lim = this.depthLimits.get(k);
    if (!lim) {
      lim = this.depthRange(tx, ty);
      this.depthLimits.set(k, lim);
    }
    const [lo, hi] = lim;
    if (natural > lo && natural < hi) return natural;
    // squeezed into the gap; movers on the same tile still sort among themselves
    const tie = (x + y - tx - ty) * 0.004;
    if (natural <= lo || lo >= hi) return lo + 0.01 + tie;
    return Math.max(lo + 0.01, hi - 0.02) + tie;
  }

  private depthRange(tx: number, ty: number): [number, number] {
    let lo = -Infinity;
    let hi = Infinity;
    const R = 6;
    const seen = new Set<number>();
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        const o = this.src.index.at(tx + dx, ty + dy);
        if (!o || seen.has(o.id)) continue;
        seen.add(o.id);
        const v = this.views.get(o.id);
        if (!v || v.flat) continue;
        const r = rectOf(o);
        const front = tx >= r.x + r.w || ty >= r.y + r.h;
        const behind = tx < r.x || ty < r.y;
        if (front === behind) continue; // beside it (no overlap on screen) or inside it
        if (front) lo = Math.max(lo, v.img.depth);
        else hi = Math.min(hi, v.img.depth);
      }
    }
    return [lo, hi];
  }

  private snapFor(itemId: string, tx: number, ty: number, rot: Rot): [number, number] {
    const def = maybeItem(itemId)!;
    const [w, h] = dims(def, rot);
    if (def.kind === 'road') {
      const s = content().balance.world.roadSnap;
      return [Math.floor(tx / s) * s, Math.floor(ty / s) * s];
    }
    return [Math.floor(tx - w / 2 + 0.5), Math.floor(ty - h / 2 + 0.5)];
  }

  private pointerTile(px: number, py: number): [number, number] {
    const w = this.screenToWorld(px, py);
    return worldToIso(w.x, w.y);
  }

  private updateGhostFromPointer(): void {
    const p = this.input.activePointer;
    if (p) this.updateGhost(p.x, p.y);
  }

  private updateGhost(px: number, py: number): void {
    if (this.mode.kind !== 'place' || !this.src) return;
    const def = maybeItem(this.mode.item);
    if (!def) return;
    const [ftx, fty] = this.pointerTile(px, py);
    const [x, y] = this.snapFor(def.id, ftx, fty, this.ghostRot);
    if (x === this.lastGhost.x && y === this.lastGhost.y) return;
    this.lastGhost = { x, y };
    const check = checkPlacement(this.src.index, def, x, y, this.ghostRot, this.mode.moveId);
    let key: string;
    let flip = false;
    if (def.kind === 'road') key = 'road.0';
    else if (def.kind === 'sidewalk') key = 'sidewalk';
    else if (def.kind === 'plot') key = 'plot.empty';
    else {
      const r = this.sprites.itemKey(def.art ?? `item.${def.id}`, this.ghostRot);
      key = r.key;
      flip = r.flip;
    }
    this.ghost.colorblind = this.colorblind;
    this.ghost.show(def, key, flip, x, y, this.ghostRot, check, this.src.state, this.src.index);
  }

  private tryPlaceAtPointer(p: Phaser.Input.Pointer): void {
    if (this.mode.kind !== 'place') return;
    const def = maybeItem(this.mode.item);
    if (!def) return;
    const [ftx, fty] = this.pointerTile(p.x, p.y);
    const [x, y] = this.snapFor(def.id, ftx, fty, this.ghostRot);
    const check = checkPlacement(this.src.index, def, x, y, this.ghostRot, this.mode.moveId);
    if (!check.ok) {
      if (!this.drag.painting) this.events_.place(x, y, this.ghostRot); // lets the controller explain why
      return;
    }
    if (this.events_.place(x, y, this.ghostRot)) this.lastGhost = { x: Number.NaN, y: Number.NaN };
  }

  // --------------------------------------------------------------- update --

  override update(time: number, delta: number): void {
    // keyboard panning
    const speed = (delta / 1000) * 700;
    let kx = 0;
    let ky = 0;
    if (this.keys.LEFT?.isDown || this.keys.A?.isDown) kx -= 1;
    if (this.keys.RIGHT?.isDown || this.keys.D?.isDown) kx += 1;
    if (this.keys.UP?.isDown || this.keys.W?.isDown) ky -= 1;
    if (this.keys.DOWN?.isDown || this.keys.S?.isDown) ky += 1;
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    if ((kx || ky) && !typing) this.panBy((kx * speed) / this.dpr, (ky * speed) / this.dpr);

    const view = this.cameras.main.worldView;
    const margin = 120;
    const rect = new Phaser.Geom.Rectangle(view.x - margin, view.y - margin, view.width + margin * 2, view.height + margin * 2);
    this.walkers.view = rect;
    this.vehicles.view = rect;
    if (this.dirtyCull) {
      this.dirtyCull = false;
      for (const v of this.views.values()) {
        const b = v.bounds;
        const vis = b.x + b.w > rect.x && b.x < rect.right && b.y + b.h > rect.y && b.y < rect.bottom;
        v.img.setVisible(vis);
        if (v.lit) v.lit.setVisible(vis && this.night > 0.01);
        if (v.overlay) v.overlay.setVisible(vis);
        if (v.glow) v.glow.setVisible(vis);
        if (v.helper) v.helper.setVisible(vis);
      }
      for (const g of this.ground) {
        const vis = g.x + 420 > rect.x && g.x - 420 < rect.right && g.y + 420 > rect.y && g.y - 80 < rect.bottom;
        g.setVisible(vis);
      }
    }
    // bobbing overlays
    if (!this.reducedMotion) {
      const bob = Math.sin(time / 300) * 3;
      for (const v of this.views.values()) {
        if (v.overlay?.visible) v.overlay.y = (v.overlay.getData('baseY') as number) + bob;
        if (v.helper?.visible) v.helper.y = (v.helper.getData('baseY') as number) - bob;
        if (v.glow?.visible) v.glow.alpha = 0.55 + Math.sin(time / 250) * 0.3;
      }
    }
    this.walkers.update(delta);
    this.vehicles.update(delta);
    this.doobers.update(time);
    if (this.src) this.extras.update(delta, this.src.state, this.src.state.now, rect);
    // time of day: the sky changes slowly, so twice a second is plenty
    this.dayClock += delta;
    if (this.dayClock > 500) {
      this.dayClock = 0;
      this.updateDaylight(false);
    }
    // sharp zoom: once the zoom has settled, redraw on-screen art to match it
    const zz = this.zoomLevel * this.dpr;
    if (zz !== this.zz) {
      this.zz = zz;
      this.zzAt = time;
    } else if (zz !== this.zzApplied && time - this.zzAt > 150) {
      this.zzApplied = zz;
      this.sprites.setZoomRes(zz);
    }
    this.sharpClock += delta;
    if (this.sharpClock > 400) {
      this.sharpClock = 0;
      this.sprites.refreshVisible();
    }
    this.sprites.pump(5);
  }

  // ------------------------------------------------------------ helpers --

  /** Screen position (CSS px) of the first object matching a predicate. */
  findObjectCss(pred: (o: WorldObject) => boolean): { id: number; x: number; y: number } | null {
    if (!this.src) return null;
    let best: { id: number; x: number; y: number; d: number } | null = null;
    const cam = this.cameras.main;
    for (const k in this.src.state.objects) {
      const o = this.src.state.objects[k]!;
      if (!pred(o)) continue;
      const css = this.objectCss(o.id);
      if (!css) continue;
      const d = Math.hypot(css[0] - cam.width / this.dpr / 2, css[1] - cam.height / this.dpr / 2);
      if (!best || d < best.d) best = { id: o.id, x: css[0], y: css[1], d };
    }
    return best;
  }

  /** Smoothly pans so an object sits slightly right of centre (clear of the goals column). */
  centerOnObject(id: number): void {
    const o = this.src.state.objects[id];
    if (!o) return;
    const r = rectOf(o);
    const [wx, wy] = isoToWorld(r.x + r.w / 2, r.y + r.h / 2);
    const target = { x: wx - 40 / this.zoomLevel, y: wy - 20 / this.zoomLevel };
    if (this.reducedMotion) {
      this.center = target;
      this.applyCamera();
      return;
    }
    const from = { ...this.center };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 450,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        this.center = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k };
        this.applyCamera();
      },
    });
  }

  /** Bring an object into view if it's off-screen. */
  reveal(id: number): void {
    if (this.isOnScreen(id)) return;
    const o = this.src.state.objects[id];
    if (!o) return;
    const r = rectOf(o);
    this.centerOnTile(r.x + r.w / 2, r.y + r.h / 2);
  }
}
