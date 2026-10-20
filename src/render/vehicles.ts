// Vehicles on 3x3 road pieces: moving vans for new residents, tour buses for
// neighbor help, and a few ambient cars for life. Cars follow smooth lane
// routes (route.ts), fade in and out instead of popping, sort against the
// buildings they pass, and switch their headlights on at night.
import Phaser from 'phaser';
import { content } from '../sim/content';
import { rectOf, type WorldIndex } from '../sim/world';
import type { GameState, WorldObject } from '../sim/types';
import { PathFinder, pieceOf, type Tile } from './path';
import { Route, type RoutePoint } from './route';
import { HH, HW, isoToWorld, type Sprites } from './sprites';

type Kind = 'van' | 'bus' | 'car1' | 'car2' | 'car3';

interface Vehicle {
  img: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image | null;
  kind: Kind;
  route: Route;
  /** Tiles per second. */
  speed: number;
  ambient: boolean;
  goal: Tile;
  onArrive?: (at: Tile) => void;
  arrived: boolean;
  waitAfter: number;
  /** Seconds left while fading out (-1 = not leaving). */
  fading: number;
  fadeLen: number;
  /** 0..1 while fading in. */
  shown: number;
  frameKey: string;
}

const FADE_IN = 0.5;
const FADE_OUT = 0.4;

export class Vehicles {
  private list: Vehicle[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  private paths: PathFinder;
  private pieces: Tile[] = [];
  view = new Phaser.Geom.Rectangle();
  ambientMax = 10;
  enabled = true;
  /** Multiplied into the cars' colours (time of day). */
  tint = 0xffffff;
  /** 0 by day, 1 at night: headlight strength. */
  night = 0;
  /** Depth for a small sprite at a tile position, sorted against nearby buildings. */
  depthAt: (x: number, y: number, bias: number) => number = (x, y, bias) => (x + y) * 10 + bias;

  constructor(private scene: Phaser.Scene, private sprites: Sprites, private index: WorldIndex) {
    this.paths = new PathFinder(index);
  }

  refresh(state: GameState, index: WorldIndex): void {
    this.index = index;
    this.paths.reset(index);
    this.pieces = [];
    for (const k in state.objects) {
      const o = state.objects[k]!;
      if (o.item === 'road') this.pieces.push([o.x, o.y]);
    }
    // cars whose road disappeared leave quietly
    for (const v of this.list) {
      if (v.fading < 0 && !v.route.upcoming().every(([x, y]) => index.isRoad(x, y))) this.leave(v, FADE_OUT);
    }
  }

  clear(): void {
    for (const v of this.list) this.release(v);
    this.list = [];
  }

  /** Nearest road piece touching an object (or null). */
  roadNear(o: WorldObject): Tile | null {
    const doors = this.index.entrances(rectOf(o));
    for (const [x, y] of doors) if (this.index.isRoad(x, y)) return pieceOf(x, y);
    return null;
  }

  /** Sends a vehicle from a few blocks away to the object; returns false if no road. */
  sendTo(o: WorldObject, kind: Kind, onArrive?: (at: Tile) => void): boolean {
    const goal = this.roadNear(o);
    if (!goal) return false;
    const start = this.farPiece(goal, 5);
    const path = this.paths.drive(start, goal) ?? [goal];
    this.spawn(kind, new Route(path, false), false, goal, onArrive);
    return true;
  }

  private farPiece(goal: Tile, depth: number): Tile {
    const s = content().balance.world.roadSnap;
    let frontier: Tile[] = [goal];
    const seen = new Set([`${goal[0]},${goal[1]}`]);
    let last = goal;
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: Tile[] = [];
      for (const [x, y] of frontier) {
        for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]] as const) {
          const n: Tile = [x + dx, y + dy];
          const k = `${n[0]},${n[1]}`;
          if (seen.has(k) || !this.index.isRoad(n[0], n[1])) continue;
          seen.add(k);
          next.push(n);
        }
      }
      if (next.length) last = next[Math.floor(Math.random() * next.length)]!;
      frontier = next;
    }
    return last;
  }

  private spawn(kind: Kind, route: Route, ambient: boolean, goal: Tile, onArrive?: (at: Tile) => void): void {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, '__WHITE');
    img.setActive(true).setVisible(true).setAlpha(0);
    const v: Vehicle = {
      img,
      beam: null,
      kind,
      route,
      speed: kind === 'bus' || kind === 'van' ? 1.1 : 1.4,
      ambient,
      goal,
      arrived: false,
      waitAfter: 1.4,
      fading: -1,
      fadeLen: FADE_OUT,
      shown: 0,
      frameKey: '',
    };
    if (onArrive) v.onArrive = onArrive;
    this.list.push(v);
    this.place(v);
  }

  update(dtMs: number): void {
    const dt = Math.min(0.1, dtMs / 1000);
    let ambient = 0;
    for (const v of this.list) if (v.ambient && v.fading < 0) ambient++;
    const want = this.enabled ? Math.min(this.ambientMax, Math.floor(this.pieces.length / 5)) : 0;
    if (ambient < want && this.pieces.length > 2 && Math.random() < dt * 0.6) {
      const start = this.pieces[Math.floor(Math.random() * this.pieces.length)]!;
      const next = this.wander(start, null);
      if (next[0] !== start[0] || next[1] !== start[1]) {
        const kinds: Kind[] = ['car1', 'car2', 'car3'];
        this.spawn(kinds[Math.floor(Math.random() * kinds.length)]!, new Route([start, next], true), true, start);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i]!;
      if (v.fading >= 0) {
        v.fading -= dt;
        if (v.fading <= 0) {
          this.release(v);
          this.list.splice(i, 1);
          continue;
        }
      } else if (v.shown < 1) {
        v.shown = Math.min(1, v.shown + dt / FADE_IN);
      }
      if (v.ambient) {
        // keep a few pieces of road known ahead, so corners can be rounded early
        while (v.route.ahead() < 3) {
          const { cur, prev } = v.route.last();
          const nxt = this.wander(cur, prev);
          if (nxt[0] === cur[0] && nxt[1] === cur[1]) break;
          v.route.push(nxt);
        }
        // too many cars (fewer roads, quieter settings): thin them out gradually
        if (ambient > want && v.fading < 0 && Math.random() < dt * 0.5) {
          this.leave(v, FADE_OUT);
          ambient--;
        }
      }
      if (!v.route.finished) {
        v.route.advance(v.speed * dt);
      } else if (v.ambient) {
        this.leave(v, FADE_OUT); // nowhere left to drive
      } else {
        if (!v.arrived) {
          v.arrived = true;
          v.onArrive?.(v.goal);
        }
        v.waitAfter -= dt;
        if (v.waitAfter <= 0) this.leave(v, 0.5);
      }
      this.place(v);
    }
  }

  private leave(v: Vehicle, seconds: number): void {
    if (v.fading >= 0) return;
    v.fading = seconds;
    v.fadeLen = seconds;
  }

  private wander(cur: Tile, prev: Tile | null): Tile {
    const s = content().balance.world.roadSnap;
    const opts: Tile[] = [];
    for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]] as const) {
      const n: Tile = [cur[0] + dx, cur[1] + dy];
      if (this.index.isRoad(n[0], n[1])) opts.push(n);
    }
    const forward = opts.filter((o) => !prev || o[0] !== prev[0] || o[1] !== prev[1]);
    const pick = forward.length ? forward : opts;
    return pick.length ? pick[Math.floor(Math.random() * pick.length)]! : cur;
  }

  private place(v: Vehicle): void {
    const p = v.route.point();
    const [wx, wy] = isoToWorld(p.x, p.y);
    const visible = this.view.contains(wx, wy);
    v.img.setPosition(wx, wy).setDepth(this.depthAt(p.x, p.y, 0.6));
    // face the nearest of the four road directions
    let dx = 0;
    let dy = 0;
    if (Math.abs(p.hx) >= Math.abs(p.hy)) dx = Math.sign(p.hx) || 1;
    else dy = Math.sign(p.hy);
    const dir = dx > 0 || dy > 0 ? 0 : 1;
    const flip = dx === 0;
    const key = `vehicle.${v.kind}.${dir}`;
    if (key !== v.frameKey || v.img.flipX !== flip) {
      this.sprites.apply(v.img, key, flip);
      v.frameKey = key;
    }
    if (v.img.tintTopLeft !== this.tint) v.img.setTint(this.tint);
    const alpha = v.shown * (v.fading >= 0 ? Math.max(0, v.fading / v.fadeLen) : 1);
    v.img.setAlpha(alpha).setVisible(visible);
    this.placeBeam(v, p, visible, alpha);
  }

  /** Headlights: a soft cone of light ahead of the car after dark. */
  private placeBeam(v: Vehicle, p: RoutePoint, visible: boolean, alpha: number): void {
    if (this.night < 0.05 || !visible) {
      v.beam?.setVisible(false);
      return;
    }
    if (!v.beam) {
      v.beam = this.beams.pop() ?? null;
      if (!v.beam) {
        v.beam = this.scene.add.image(0, 0, '__WHITE');
        this.sprites.apply(v.beam, 'light.beam');
        v.beam.setScale(v.beam.scaleX * 0.42);
      }
    }
    const [bx, by] = isoToWorld(p.x + p.hx * 0.45, p.y + p.hy * 0.45);
    const angle = Math.atan2((p.hx + p.hy) * HH, (p.hx - p.hy) * HW);
    v.beam
      .setPosition(bx, by - 3)
      .setRotation(angle)
      .setDepth(v.img.depth - 0.01)
      .setAlpha(alpha * this.night * 0.75)
      .setActive(true)
      .setVisible(true);
  }

  private release(v: Vehicle): void {
    v.img.setVisible(false).setActive(false);
    this.pool.push(v.img);
    if (v.beam) {
      v.beam.setVisible(false).setActive(false);
      this.beams.push(v.beam);
      v.beam = null;
    }
  }
}
