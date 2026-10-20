// Citizens walking the sidewalks: residents leave home, walk to an open shop,
// pause (a happy bubble) and head back; tourists start and end at hotels.
import Phaser from 'phaser';
import { CITIZENS } from '../art/index';
import { maybeItem } from '../sim/content';
import { rectOf, type WorldIndex } from '../sim/world';
import type { GameState, WorldObject } from '../sim/types';
import { PathFinder, type Tile } from './path';
import { isoToWorld, type Sprites } from './sprites';

interface Walker {
  img: Phaser.GameObjects.Image;
  look: number;
  path: Tile[];
  seg: number;
  t: number;
  speed: number;
  phase: 'go' | 'pause' | 'back';
  wait: number;
  ox: number;
  oy: number;
  anim: number;
  tourist: boolean;
  frameKey: string;
  bubble: Phaser.GameObjects.Image | null;
}

const RESIDENT_LOOKS = CITIZENS.map((c, i) => ({ c, i })).filter((x) => !x.c.tourist).map((x) => x.i);
const TOURIST_LOOKS = CITIZENS.map((c, i) => ({ c, i })).filter((x) => x.c.tourist).map((x) => x.i);

export class Walkers {
  private walkers: Walker[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private bubbles: Phaser.GameObjects.Image[] = [];
  private spawnClock = 0;
  private homes: { o: WorldObject; doors: Tile[] }[] = [];
  private shops: { o: WorldObject; doors: Tile[] }[] = [];
  private hotels: { o: WorldObject; doors: Tile[] }[] = [];
  private paths: PathFinder;
  max = 150;
  /** Customers per minute from the simulation (residents, tourists). */
  rates = { residents: 0, tourists: 0 };
  view = new Phaser.Geom.Rectangle();
  enabled = true;
  /** Multiplied into the walkers' colours (time of day). */
  tint = 0xffffff;
  /** 0 by day, 1 at night: fewer people are out after dark. */
  night = 0;
  /** Depth for a small sprite at a tile position, sorted against nearby buildings. */
  depthAt: (x: number, y: number, bias: number) => number = (x, y, bias) => (x + y) * 10 + bias;

  constructor(private scene: Phaser.Scene, private sprites: Sprites, index: WorldIndex) {
    this.paths = new PathFinder(index);
  }

  get count(): number {
    return this.walkers.length;
  }

  /** Rebuild homes/shops after the city changed. */
  refresh(state: GameState, index: WorldIndex, roadsChanged: boolean): void {
    if (roadsChanged) this.paths.reset(index);
    this.homes = [];
    this.shops = [];
    this.hotels = [];
    for (const k in state.objects) {
      const o = state.objects[k]!;
      if (!o.built) continue;
      const def = maybeItem(o.item);
      if (!def) continue;
      const kind = def.kind;
      if (kind !== 'house' && kind !== 'business' && kind !== 'hotel') continue;
      const doors = index.entrances(rectOf(o));
      if (doors.length === 0) continue;
      if (kind === 'house') this.homes.push({ o, doors });
      else if (kind === 'hotel') this.hotels.push({ o, doors });
      else if (o.shop?.state === 'open') this.shops.push({ o, doors });
    }
  }

  clear(): void {
    for (const w of this.walkers) this.release(w);
    this.walkers = [];
  }

  update(dtMs: number): void {
    const dt = Math.min(0.1, dtMs / 1000);
    if (this.enabled) this.spawnTick(dt);
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i]!;
      if (!this.step(w, dt)) {
        this.release(w);
        this.walkers.splice(i, 1);
      }
    }
  }

  private spawnTick(dt: number): void {
    if (this.homes.length === 0 && this.hotels.length === 0) return;
    const shopping = this.shops.length > 0;
    const perMin = shopping ? this.rates.residents + this.rates.tourists : Math.min(6, this.homes.length * 0.8);
    // Visual walkers: one per customer up to ~2/s, scaled down when busy.
    const interval = Math.max(0.35, Math.min(4, 60 / Math.max(1, perMin))) * (1 + 1.5 * this.night);
    this.spawnClock += dt;
    if (this.spawnClock < interval) return;
    this.spawnClock = 0;
    if (this.walkers.length >= this.max * (1 - 0.5 * this.night)) return;
    const touristShare = shopping && this.hotels.length > 0 ? this.rates.tourists / Math.max(1, perMin) : 0;
    const tourist = Math.random() < touristShare;
    const fromList = tourist ? this.hotels : this.homes;
    if (fromList.length === 0) return;
    const home = fromList[Math.floor(Math.random() * fromList.length)]!;
    const start = home.doors[Math.floor(Math.random() * home.doors.length)]!;
    let target: Tile | null = null;
    if (shopping) {
      const shop = this.shops[Math.floor(Math.random() * this.shops.length)]!;
      target = shop.doors[Math.floor(Math.random() * shop.doors.length)]!;
    } else {
      // stroll: wander to another home's door
      const other = this.homes[Math.floor(Math.random() * this.homes.length)]!;
      target = other.doors[0]!;
    }
    if (!target) return;
    const path = this.paths.walk(start, target);
    if (!path || path.length < 2) return;
    this.add(path, tourist);
  }

  private add(path: Tile[], tourist: boolean): void {
    const looks = tourist && TOURIST_LOOKS.length ? TOURIST_LOOKS : RESIDENT_LOOKS;
    const look = looks[Math.floor(Math.random() * looks.length)]!;
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, '__WHITE');
    img.setActive(true).setVisible(true).setAlpha(1);
    const w: Walker = {
      img,
      look,
      path,
      seg: 0,
      t: 0,
      speed: 1.1 + Math.random() * 0.5,
      phase: 'go',
      wait: 0,
      ox: (Math.random() - 0.5) * 0.5,
      oy: (Math.random() - 0.5) * 0.5,
      anim: Math.random() * 10,
      tourist,
      frameKey: '',
      bubble: null,
    };
    this.walkers.push(w);
    this.place(w);
  }

  private step(w: Walker, dt: number): boolean {
    if (w.phase === 'pause') {
      w.wait -= dt;
      if (w.bubble) {
        w.bubble.y -= dt * 8;
        w.bubble.alpha = Math.max(0, w.wait / 0.9);
      }
      if (w.wait <= 0) {
        if (w.bubble) {
          w.bubble.setVisible(false).setActive(false);
          this.bubbles.push(w.bubble);
          w.bubble = null;
        }
        w.phase = 'back';
        w.path = w.path.slice().reverse();
        w.seg = 0;
        w.t = 0;
      }
      return true;
    }
    w.t += w.speed * dt;
    while (w.t >= 1) {
      w.t -= 1;
      w.seg++;
      if (w.seg >= w.path.length - 1) {
        if (w.phase === 'go') {
          w.phase = 'pause';
          w.wait = 0.9;
          w.seg = w.path.length - 1;
          w.t = 0;
          this.showBubble(w);
          this.place(w);
          return true;
        }
        return false;
      }
    }
    w.anim += dt;
    this.place(w);
    return true;
  }

  private place(w: Walker): void {
    const a = w.path[Math.min(w.seg, w.path.length - 1)]!;
    const b = w.path[Math.min(w.seg + 1, w.path.length - 1)]!;
    const tt = Math.max(0, w.t);
    const x = a[0] + (b[0] - a[0]) * tt + 0.5 + w.ox;
    const y = a[1] + (b[1] - a[1]) * tt + 0.5 + w.oy;
    const [wx, wy] = isoToWorld(x, y);
    w.img.setPosition(wx, wy);
    w.img.setDepth(this.depthAt(x, y, 0.5));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const toward = dx > 0 || dy > 0 ? 0 : 1;
    const flip = toward === 0 ? dy > 0 : dx < 0;
    const moving = w.phase !== 'pause';
    const f = moving ? [0, 1, 2, 1][Math.floor(w.anim * 8) % 4]! : 1;
    const key = `citizen.${w.look}.${toward}.${f}`;
    if (key !== w.frameKey || w.img.flipX !== flip) {
      this.sprites.apply(w.img, key, flip);
      w.frameKey = key;
    }
    if (w.img.tintTopLeft !== this.tint) w.img.setTint(this.tint);
    const vis = this.view.contains(wx, wy - 10);
    w.img.setVisible(vis);
  }

  private showBubble(w: Walker): void {
    const b = this.bubbles.pop() ?? this.scene.add.image(0, 0, '__WHITE');
    this.sprites.apply(b, w.tourist ? 'icon.coin' : 'icon.reputation');
    b.setOrigin(0.5, 1).setScale(b.scaleX * 0.32).setPosition(w.img.x, w.img.y - 30).setDepth(w.img.depth + 0.1).setAlpha(1).setVisible(true).setActive(true);
    w.bubble = b;
  }

  private release(w: Walker): void {
    w.img.setVisible(false).setActive(false);
    this.pool.push(w.img);
    if (w.bubble) {
      w.bubble.setVisible(false).setActive(false);
      this.bubbles.push(w.bubble);
      w.bubble = null;
    }
  }

  /** Spawn a few residents stepping out of a moving van towards a house. */
  moveIn(from: Tile, house: WorldObject, index: WorldIndex): void {
    const doors = index.entrances(rectOf(house));
    const door = doors[0];
    if (!door) return;
    const path = this.paths.walk(from, door) ?? [from, door];
    for (let i = 0; i < 3; i++) {
      if (this.walkers.length >= this.max) return;
      this.add(path.length >= 2 ? path : [door, door], false);
      const w = this.walkers[this.walkers.length - 1]!;
      w.phase = 'back'; // disappear at the house door
      w.speed = 1.6;
      w.t = -i * 0.6;
    }
  }

}
