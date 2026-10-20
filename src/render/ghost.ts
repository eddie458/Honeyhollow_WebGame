// Placement preview: translucent sprite, footprint tiles (green/red or
// blue/orange in colorblind mode, plus a hatch pattern and check/cross icon so
// color is never the only cue), decoration reach and bonus previews.
import Phaser from 'phaser';
import { decoPreview } from '../sim/economy';
import { dims, expandRect, rectOf, type PlaceCheck, type WorldIndex } from '../sim/world';
import type { GameState, ItemDef, Rot } from '../sim/types';
import { FONT } from './fx';
import { isoToWorld, type Sprites } from './sprites';

export const GHOST_DEPTH = 8_000_000;

export class Ghost {
  readonly g: Phaser.GameObjects.Graphics;
  readonly img: Phaser.GameObjects.Image;
  readonly mark: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.Text[] = [];
  private key = '';
  colorblind = false;

  constructor(private scene: Phaser.Scene, private sprites: Sprites, private textRes: number) {
    this.g = scene.add.graphics().setDepth(GHOST_DEPTH);
    this.img = scene.add.image(0, 0, '__WHITE').setDepth(GHOST_DEPTH + 1).setAlpha(0.75).setVisible(false);
    this.mark = scene.add.image(0, 0, '__WHITE').setDepth(GHOST_DEPTH + 2).setVisible(false);
  }

  hide(): void {
    this.g.clear();
    this.img.setVisible(false);
    this.mark.setVisible(false);
    for (const l of this.labels) l.setVisible(false);
  }

  show(
    def: ItemDef,
    key: string,
    flip: boolean,
    x: number,
    y: number,
    rot: Rot,
    check: PlaceCheck,
    state: GameState,
    _index: WorldIndex,
  ): void {
    const [w, h] = dims(def, rot);
    const g = this.g;
    g.clear();
    const ok = check.ok;
    const good = this.colorblind ? 0x3b8fe0 : 0x5cd65c;
    const bad = this.colorblind ? 0xff9f1c : 0xff5555;
    const color = ok ? good : bad;

    // decoration reach + bonus preview
    for (const l of this.labels) l.setVisible(false);
    if (def.kind === 'decoration' && def.bonus) {
      const area = expandRect({ x, y, w, h }, def.radius ?? 3);
      this.diamond(area.x, area.y, area.w, area.h, 0xffd23f, 0.1, 0xf2b705, 0.9);
      let li = 0;
      for (const k in state.objects) {
        const o = state.objects[k]!;
        const pct = decoPreview(def, { x, y, w, h }, o);
        if (pct <= 0) continue;
        const r = rectOf(o);
        const [lx, ly] = isoToWorld(r.x + r.w / 2, r.y + r.h / 2);
        const label = this.label(li++);
        label.setText(`+${pct}%`).setPosition(lx, ly - 28).setVisible(true);
      }
    }

    // footprint
    this.diamond(x, y, w, h, color, ok ? 0.38 : 0.45, color, 1);
    if (!ok) {
      // hatch pattern for invalid tiles (not color-only)
      g.lineStyle(2, 0xffffff, 0.55);
      for (let i = 1; i < w + h; i++) {
        const t = i / (w + h);
        const [ax, ay] = isoToWorld(x + Math.min(w, (w + h) * t), y + Math.max(0, (w + h) * t - w));
        const [bx, by] = isoToWorld(x + Math.max(0, (w + h) * t - h), y + Math.min(h, (w + h) * t));
        g.lineBetween(ax, ay, bx, by);
      }
    }

    if (key !== this.key || this.img.flipX !== flip) {
      this.key = key;
      this.sprites.apply(this.img, key, flip);
      this.img.setAlpha(0.78);
    }
    const [wx, wy] = isoToWorld(x, y);
    this.img.setPosition(wx, wy).setVisible(true);
    if (!ok) this.img.setTint(0xffb0b0);
    else this.img.clearTint();

    const markKey = ok ? (def.needsRoad ? 'icon.visit' : 'icon.check') : check.reason === 'needsRoad' ? 'icon.noRoad' : 'icon.cancel';
    this.sprites.apply(this.mark, markKey);
    this.mark.setScale(this.mark.scaleX * 0.55);
    const b = this.sprites.bounds(this.img, key);
    const [cx] = isoToWorld(x + w / 2, y + h / 2);
    this.mark.setPosition(cx, Math.min(b.y, wy) - 8).setVisible(true);
  }

  private label(i: number): Phaser.GameObjects.Text {
    let l = this.labels[i];
    if (!l) {
      l = this.scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: '17px', fontStyle: '700', color: '#fff6b0', stroke: '#3b2a1e', strokeThickness: 5, resolution: this.textRes })
        .setOrigin(0.5, 1)
        .setDepth(GHOST_DEPTH + 3);
      this.labels[i] = l;
    }
    return l;
  }

  private diamond(x: number, y: number, w: number, h: number, fill: number, fa: number, stroke: number, sa: number): void {
    const pts = [isoToWorld(x, y), isoToWorld(x + w, y), isoToWorld(x + w, y + h), isoToWorld(x, y + h)].map(([px, py]) => new Phaser.Math.Vector2(px, py));
    this.g.fillStyle(fill, fa);
    this.g.fillPoints(pts, true);
    this.g.lineStyle(2, stroke, sa);
    this.g.strokePoints(pts, true);
  }

  /** Simple outline used by expand mode / selection. */
  outline(x: number, y: number, w: number, h: number, color: number, alpha = 0.9): void {
    this.diamond(x, y, w, h, color, 0.12, color, alpha);
  }
}
