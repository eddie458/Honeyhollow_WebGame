// Pooled floating numbers / labels and small particle puffs in world space.
import Phaser from 'phaser';
import type { Sprites } from './sprites';

export const FONT = '"Fredoka Variable", "Fredoka", "Trebuchet MS", system-ui, sans-serif';
export const FX_DEPTH = 9_000_000;

export class Fx {
  private texts: Phaser.GameObjects.Text[] = [];
  private puffs: Phaser.GameObjects.Image[] = [];
  reducedMotion = false;

  constructor(private scene: Phaser.Scene, private sprites: Sprites, private textRes: number) {}

  private text(): Phaser.GameObjects.Text {
    const free = this.texts.find((t) => !t.active);
    if (free) return free.setActive(true).setVisible(true);
    const t = this.scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: '700',
      color: '#ffffff',
      stroke: '#3b2a1e',
      strokeThickness: 5,
      resolution: this.textRes,
    });
    t.setOrigin(0.5, 1).setDepth(FX_DEPTH + 10);
    this.texts.push(t);
    return t;
  }

  /** Floating "+120" style label rising from a world point. */
  float(wx: number, wy: number, label: string, color = '#ffffff', size = 18): void {
    const t = this.text();
    t.setText(label).setColor(color).setFontSize(size).setPosition(wx, wy).setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(t);
    if (this.reducedMotion) {
      t.setScale(1);
      this.scene.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300, onComplete: () => t.setActive(false).setVisible(false) });
      return;
    }
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t,
      y: wy - 46,
      alpha: { from: 1, to: 0 },
      duration: 1300,
      delay: 250,
      ease: 'Sine.In',
      onComplete: () => t.setActive(false).setVisible(false),
    });
  }

  /** Little dust/sparkle puff (construction clicks, harvests). */
  puff(wx: number, wy: number, color = 0xf3e3bf, n = 6): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      let p = this.puffs.find((x) => !x.active);
      if (!p) {
        p = this.scene.add.image(0, 0, '__WHITE');
        this.sprites.apply(p, 'dot');
        p.setDepth(FX_DEPTH);
        this.puffs.push(p);
      }
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      p.setActive(true).setVisible(true).setPosition(wx, wy).setAlpha(0.9).setTint(color).setScale(0.6 + Math.random() * 0.5);
      const target = p;
      this.scene.tweens.add({
        targets: target,
        x: wx + Math.cos(a) * (14 + Math.random() * 10),
        y: wy + Math.sin(a) * 7 - 10,
        alpha: 0,
        scale: 0.2,
        duration: 450 + Math.random() * 200,
        ease: 'Quad.Out',
        onComplete: () => target.setActive(false).setVisible(false),
      });
    }
  }
}
