// Moving set pieces that are derived from state rather than being objects:
// boats at the pier, the train on the railway, sparkles while a wonder's
// town-wide boost is running, and the lighthouse beam after dark.
import Phaser from 'phaser';
import { content, maybeItem } from '../sim/content';
import { activeBoosts } from '../sim/economy';
import { rectOf } from '../sim/world';
import type { GameState, WorldObject } from '../sim/types';
import { FX_DEPTH } from './fx';
import { isoToWorld, type Sprites } from './sprites';

type BerthState = 'free' | 'away' | 'docked';

interface Berth {
  state: BerthState;
  img: Phaser.GameObjects.Image | null;
}

/** Above every building, below the status icons. */
const BEAM_DEPTH = 4_000_000;

export class Extras {
  private berths = new Map<string, Berth>();
  private train: Phaser.GameObjects.Image | null = null;
  private trainState: 'home' | 'away' | 'back' | 'none' = 'none';
  private sparkleClock = 0;
  private sparkles: Phaser.GameObjects.Image[] = [];
  /** Two opposite beams per lighthouse, keyed by object id. */
  private beams = new Map<number, Phaser.GameObjects.Image[]>();
  private beamAngle = 0;
  reducedMotion = false;
  private tint = 0xffffff;
  private night = 0;

  constructor(private scene: Phaser.Scene, private sprites: Sprites) {}

  clear(): void {
    for (const b of this.berths.values()) b.img?.destroy();
    this.berths.clear();
    this.train?.destroy();
    this.train = null;
    this.trainState = 'none';
    for (const pair of this.beams.values()) for (const b of pair) b.destroy();
    this.beams.clear();
  }

  /** Time of day: tints boats and the train, and lights the lighthouse. */
  setDaylight(tint: number, night: number): void {
    this.night = night;
    if (tint === this.tint) return;
    this.tint = tint;
    for (const b of this.berths.values()) b.img?.setTint(tint);
    this.train?.setTint(tint);
  }

  /** Berth i of a pier: boats moor along the right side of the dock. */
  static berth(o: WorldObject, i: number): [number, number] {
    return [o.x + 3.55, o.y + 3 + 0.9 + i * 1.5];
  }

  sync(s: GameState, now: number, home: boolean): void {
    const seen = new Set<string>();
    for (const k in s.objects) {
      const o = s.objects[k]!;
      const def = maybeItem(o.item);
      if (def?.kind !== 'pier' || !o.built) continue;
      (o.ships ?? []).forEach((sh, i) => {
        const key = `${o.id}:${i}`;
        seen.add(key);
        let state: BerthState = 'free';
        if (sh) {
          const c = content().contracts[sh.contract];
          state = c && now >= sh.startedAt + c.time * 1000 ? 'docked' : 'away';
        }
        this.setBerth(key, o, i, state);
      });
    }
    for (const [key, b] of this.berths) {
      if (!seen.has(key)) {
        b.img?.destroy();
        this.berths.delete(key);
      }
    }
    this.syncBeams(s);
    if (home) this.syncTrain(s, now);
    else if (this.train) {
      this.train.destroy();
      this.train = null;
      this.trainState = 'none';
    }
  }

  private boatAt(x: number, y: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, '__WHITE');
    this.sprites.apply(img, 'boat');
    const [wx, wy] = isoToWorld(x, y);
    img.setPosition(wx, wy).setDepth((x + y) * 10 + 0.4).setTint(this.tint);
    return img;
  }

  /** Each finished lighthouse gets a pair of beams at its lantern (shown at night). */
  private syncBeams(s: GameState): void {
    const seen = new Set<number>();
    for (const k in s.objects) {
      const o = s.objects[k]!;
      if (o.item !== 'lighthouse' || !o.built) continue;
      seen.add(o.id);
      if (this.beams.has(o.id)) continue;
      // the lantern sits on the tower at (2.4, 1.9) of the footprint, 140 px up
      const [lx, ly] = o.rot === 1 ? [o.x + 1.9, o.y + 2.4] : [o.x + 2.4, o.y + 1.9];
      const [wx, wy] = isoToWorld(lx, ly);
      const pair = [0, 1].map(() => {
        const img = this.scene.add.image(0, 0, '__WHITE');
        this.sprites.apply(img, 'light.beam');
        img.setScale(img.scaleX * 2.2).setPosition(wx, wy - 140).setDepth(BEAM_DEPTH).setVisible(false);
        return img;
      });
      this.beams.set(o.id, pair);
    }
    for (const [id, pair] of this.beams) {
      if (seen.has(id)) continue;
      for (const b of pair) b.destroy();
      this.beams.delete(id);
    }
  }

  private setBerth(key: string, o: WorldObject, i: number, state: BerthState): void {
    let b = this.berths.get(key);
    const [bx, by] = Extras.berth(o, i);
    if (!b) {
      // first sight: show the steady state without animation
      b = { state, img: state === 'docked' ? this.boatAt(bx, by) : null };
      this.berths.set(key, b);
      return;
    }
    if (b.state === state) return;
    const prev = b.state;
    b.state = state;
    if (prev === 'free' && state === 'away') {
      // a boat sets sail: it appears at the berth and heads out to sea
      const img = this.boatAt(bx, by);
      const [tx, ty] = isoToWorld(bx, by + 9);
      if (this.reducedMotion) img.destroy();
      else this.scene.tweens.add({ targets: img, x: tx, y: ty, alpha: 0, duration: 2600, ease: 'Sine.In', onComplete: () => img.destroy() });
    } else if (state === 'docked') {
      b.img?.destroy();
      const img = this.boatAt(bx, by + 9);
      const [tx, ty] = isoToWorld(bx, by);
      img.setAlpha(0);
      b.img = img;
      if (this.reducedMotion) img.setPosition(tx, ty).setAlpha(1);
      else this.scene.tweens.add({ targets: img, x: tx, y: ty, alpha: 1, duration: 2400, ease: 'Sine.Out' });
    } else if (state === 'free' || state === 'away') {
      // unloaded: the boat is empty and ready again
      b.img?.destroy();
      b.img = null;
    }
  }

  private syncTrain(s: GameState, now: number): void {
    let station: WorldObject | undefined;
    for (const k in s.objects) {
      const o = s.objects[k]!;
      if (maybeItem(o.item)?.kind === 'station') station = o;
    }
    if (!station) return;
    let want: 'home' | 'away' | 'back' = 'home';
    if (s.train) {
      const r = content().routes[s.train.route];
      want = r && now >= s.train.startedAt + r.time * 1000 ? 'back' : 'away';
    }
    if (want === this.trainState) return;
    const w = content().balance.world;
    const r = rectOf(station);
    const tx = w.railX + w.railWidth / 2;
    const ty = r.y + r.h / 2;
    const [px, py] = isoToWorld(tx, ty);
    const [fx, fy] = isoToWorld(tx, ty - 16);
    const prev = this.trainState;
    this.trainState = want;
    if (!this.train) {
      this.train = this.scene.add.image(0, 0, '__WHITE');
      this.train.setDepth((tx + ty) * 10 + 0.3).setTint(this.tint);
    }
    const img = this.train;
    this.scene.tweens.killTweensOf(img);
    if (want === 'away') {
      this.sprites.apply(img, 'train.0');
      img.setPosition(px, py).setAlpha(1);
      if (prev === 'none' || this.reducedMotion) img.setVisible(false);
      else this.scene.tweens.add({ targets: img, x: fx, y: fy, alpha: 0, duration: 3200, ease: 'Sine.In', onComplete: () => img.setVisible(false) });
    } else {
      this.sprites.apply(img, 'train.1');
      img.setVisible(true);
      if (prev === 'away' && !this.reducedMotion) {
        img.setPosition(fx, fy).setAlpha(0);
        this.scene.tweens.add({ targets: img, x: px, y: py, alpha: 1, duration: 3200, ease: 'Sine.Out' });
      } else {
        img.setPosition(px, py).setAlpha(1);
      }
    }
  }

  /** Sweeps the lighthouse beams and twinkles stars over buildings boosted by a wonder. */
  update(delta: number, s: GameState, now: number, view: Phaser.Geom.Rectangle): void {
    this.updateBeams(delta, view);
    if (this.reducedMotion) return;
    const boosts = activeBoosts(s, now);
    if (boosts.length === 0) return;
    this.sparkleClock += delta;
    if (this.sparkleClock < 260) return;
    this.sparkleClock = 0;
    const crops = boosts.some((b) => b.cropGoods);
    const shops = boosts.some((b) => b.shopSpeed || b.payout);
    const targets: WorldObject[] = [];
    for (const k in s.objects) {
      const o = s.objects[k]!;
      const kind = maybeItem(o.item)?.kind;
      if ((crops && kind === 'plot' && o.crop) || (shops && kind === 'business' && o.built)) targets.push(o);
    }
    for (let n = 0; n < 3 && targets.length; n++) {
      const o = targets[Math.floor(Math.random() * targets.length)]!;
      const r = rectOf(o);
      const [wx, wy] = isoToWorld(r.x + Math.random() * r.w, r.y + Math.random() * r.h);
      if (!view.contains(wx, wy)) continue;
      let sp = this.sparkles.find((x) => !x.active);
      if (!sp) {
        sp = this.scene.add.image(0, 0, '__WHITE');
        this.sparkles.push(sp);
      }
      this.sprites.apply(sp, 'icon.sparkle');
      const base = sp.scaleX;
      sp.setActive(true).setVisible(true).setPosition(wx, wy - 10 - Math.random() * 20).setDepth(FX_DEPTH - 1).setScale(base * 0.1).setAlpha(1);
      const target = sp;
      this.scene.tweens.add({
        targets: target,
        scale: base * 0.45,
        y: target.y - 14,
        duration: 380,
        yoyo: true,
        ease: 'Sine.Out',
        onComplete: () => target.setActive(false).setVisible(false),
      });
    }
  }

  private updateBeams(delta: number, view: Phaser.Geom.Rectangle): void {
    if (this.beams.size === 0) return;
    const on = this.night > 0.05;
    // one slow turn every ~12 seconds; a still beam with reduced motion
    if (on && !this.reducedMotion) this.beamAngle = (this.beamAngle + delta * 0.00052) % (Math.PI * 2);
    for (const pair of this.beams.values()) {
      pair.forEach((img, i) => {
        if (!on || !view.contains(img.x, img.y)) {
          img.setVisible(false);
          return;
        }
        // a horizontal beam turning around the tower, seen from the iso camera
        const a = this.beamAngle + i * Math.PI;
        const sx = Math.cos(a) - Math.sin(a);
        const sy = (Math.cos(a) + Math.sin(a)) / 2;
        img.setRotation(Math.atan2(sy, sx)).setAlpha(0.5 * this.night).setVisible(true);
      });
    }
  }
}
