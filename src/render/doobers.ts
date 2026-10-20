// Doobers: reward pickups that burst out of buildings, bounce, and wait to be
// hovered/tapped (or auto-collect after a few seconds), then fly to the HUD.
import Phaser from 'phaser';
import type { Drop } from '../sim/types';
import { FX_DEPTH } from './fx';
import type { Sprites } from './sprites';

export interface Doober {
  img: Phaser.GameObjects.Image;
  drop: Drop;
  bornAt: number;
  landed: boolean;
  collected: boolean;
  baseY: number;
  life: number;
}

const MAX_ACTIVE = 70;

export function dooberIcon(d: Drop): string {
  switch (d.kind) {
    case 'coins':
      return 'icon.coin';
    case 'xp':
      return 'icon.xp';
    case 'energy':
      return 'icon.energy';
    case 'goods':
      return 'icon.goods';
    case 'reputation':
      return 'icon.reputation';
    case 'volunteer':
      return 'icon.volunteer';
    case 'permit':
      return 'icon.permit';
    case 'collectible':
    case 'part':
      return `icon.${d.id ?? 'part'}`;
    default:
      return 'icon.coin';
  }
}

export class Doobers {
  readonly active: Doober[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  reducedMotion = false;

  constructor(
    private scene: Phaser.Scene,
    private sprites: Sprites,
    /** Called when a pickup is collected, with its current world position. */
    private onCollect: (d: Drop, wx: number, wy: number) => void,
  ) {}

  spawn(wx: number, wy: number, drops: Drop[], groundY = wy + 14): void {
    const now = this.scene.time.now;
    drops.forEach((drop, i) => {
      if (this.active.length >= MAX_ACTIVE) {
        this.onCollect(drop, wx, wy);
        return;
      }
      const img = this.pool.pop() ?? this.scene.add.image(0, 0, '__WHITE');
      const key = dooberIcon(drop);
      if (!this.sprites.apply(img, this.sprites.has(key) ? key : 'icon.coin')) return;
      const scale = (drop.kind === 'collectible' ? 0.72 : 0.56) * img.scaleX;
      img.setScale(scale).setOrigin(0.5, 0.5).setDepth(FX_DEPTH + 1).setVisible(true).setActive(true).setAlpha(1);
      img.setPosition(wx, wy - 10);
      const spread = (i - (drops.length - 1) / 2) * 22 + (Math.random() - 0.5) * 16;
      const tx = wx + spread;
      const ty = groundY + Math.random() * 14 + Math.abs(spread) * 0.12;
      const d: Doober = { img, drop, bornAt: now + i * 60, landed: false, collected: false, baseY: ty, life: 4200 + Math.random() * 1600 };
      this.active.push(d);
      if (this.reducedMotion) {
        img.setPosition(tx, ty);
        d.landed = true;
        return;
      }
      // arc: x linearly, y up then down with a bounce
      this.scene.tweens.add({ targets: img, x: tx, duration: 520, delay: i * 60, ease: 'Linear' });
      this.scene.tweens.add({
        targets: img,
        y: { from: wy - 10, to: wy - 46 - Math.random() * 20 },
        duration: 230,
        delay: i * 60,
        ease: 'Quad.Out',
        onComplete: () => {
          this.scene.tweens.add({
            targets: img,
            y: ty,
            duration: 290,
            ease: 'Bounce.Out',
            onComplete: () => {
              d.landed = true;
            },
          });
        },
      });
    });
  }

  /** Collects pickups near a world point (hover/tap). Returns how many. */
  collectNear(wx: number, wy: number, radius: number): number {
    let n = 0;
    for (const d of this.active) {
      if (d.collected) continue;
      const dx = d.img.x - wx;
      const dy = d.img.y - wy;
      if (dx * dx + dy * dy <= radius * radius) {
        this.collect(d);
        n++;
      }
    }
    return n;
  }

  collectAll(): void {
    for (const d of this.active) if (!d.collected) this.collect(d);
  }

  private collect(d: Doober): void {
    d.collected = true;
    this.scene.tweens.killTweensOf(d.img);
    this.onCollect(d.drop, d.img.x, d.img.y);
    d.img.setVisible(false).setActive(false);
  }

  update(time: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const d = this.active[i]!;
      if (d.collected) {
        this.active.splice(i, 1);
        this.pool.push(d.img);
        continue;
      }
      if (d.landed && !this.reducedMotion) {
        d.img.y = d.baseY - Math.abs(Math.sin((time - d.bornAt) / 260)) * 3;
      }
      if (time - d.bornAt > d.life) this.collect(d);
    }
  }
}
