// Bridges the SpriteBank (procedural atlas pages + external overrides) into
// Phaser textures and applies frames to images with the right iso anchor.
//
// Sharp zoom: the atlas is drawn at a modest base resolution so the game
// starts fast. When the camera zooms in past it, images showing a redrawable
// sprite switch to a copy drawn at the zoom's resolution. Only sprites that are
// on screen get redrawn (a few per frame, within a memory budget), and the
// copies are dropped again a while after zooming back out.
import Phaser from 'phaser';
import { hitMask, type FrameInfo, type Rendered, type SpriteBank } from '../art/atlas';

export const HW = 32;
export const HH = 16;

export function isoToWorld(x: number, y: number): [number, number] {
  return [(x - y) * HW, (x + y) * HH];
}

/** World pixel -> fractional tile coordinates. */
export function worldToIso(wx: number, wy: number): [number, number] {
  const a = wx / HW;
  const b = wy / HH;
  return [(a + b) / 2, (b - a) / 2];
}

/** Texture resolutions sharp copies are drawn at. */
const STEPS = [1.5, 2, 2.5, 3];
/** Ground lots are big and soft; they stop at this resolution. */
const LOT_MAX = 2;
/** Texture pixels kept in sharp copies at most (about 64 MB of GPU memory). */
const BUDGET = 16_000_000;
/** Sharp copies are dropped this long after zooming back out. */
const KEEP_MS = 15_000;
const NO_MASK = new Uint8Array(0);
/** Tiny or blurry sprites that gain nothing from sharp copies (effects scale them freely). */
const KEEP_BASE = new Set(['dot', 'glow.blue', 'glow.gold']);

interface Sharp {
  info: FrameInfo;
  pixels: number;
  used: number;
}

interface User {
  key: string;
  /** Resolution of the frame the image shows now. */
  res: number;
}

export class Sprites {
  /** The "Sharp zoom" setting. */
  sharpEnabled = true;
  /** Texture resolution the camera wants (0 = the base atlas is fine). */
  private want = 0;
  private sharp = new Map<string, Sharp>();
  private queue = new Set<string>();
  private users = new Map<Phaser.GameObjects.Image, User>();
  private resOf = new WeakMap<Phaser.GameObjects.Image, number>();
  private toFree = new Set<string>();
  private pixels = 0;
  private lowSince = 0;
  private seq = 0;
  private made = 0;

  constructor(readonly scene: Phaser.Scene, readonly bank: SpriteBank) {}

  /** Uploads pending atlas pages to the GPU as Phaser textures. */
  upload(pages: ReturnType<SpriteBank['pack']>): void {
    for (const page of pages) {
      if (this.scene.textures.exists(page.key)) this.scene.textures.remove(page.key);
      const tex = this.scene.textures.addCanvas(page.key, page.canvas);
      if (!tex) continue;
      for (const f of page.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
  }

  has(key: string): boolean {
    return this.bank.frames.has(key);
  }

  info(key: string): FrameInfo | undefined {
    return this.bank.frames.get(key);
  }

  /** Sets texture/frame/origin/scale. Returns false if the key is unknown. */
  apply(img: Phaser.GameObjects.Image, key: string, flip = false): boolean {
    const base = this.bank.frames.get(key);
    if (!base) return false;
    let f = base;
    if (this.bank.canRender(key) && !KEEP_BASE.has(key)) {
      f = this.pick(key, base);
      if (!this.users.has(img)) img.once(Phaser.GameObjects.Events.DESTROY, () => this.users.delete(img));
      this.users.set(img, { key, res: f.res });
    } else {
      this.users.delete(img);
    }
    this.show(img, f, flip, 1);
    return true;
  }

  /** Resolves an item sprite for a facing, mirroring facing 0 when needed. */
  itemKey(base: string, rot: 0 | 1): { key: string; flip: boolean } {
    if (rot === 1 && this.bank.frames.has(`${base}.1`)) return { key: `${base}.1`, flip: false };
    if (this.bank.frames.has(`${base}.0`)) return { key: `${base}.0`, flip: rot === 1 };
    return { key: base, flip: rot === 1 };
  }

  /** Pixel-accurate hit test of a world point against an image's sprite (any resolution). */
  hit(img: Phaser.GameObjects.Image, key: string, wx: number, wy: number): boolean {
    const f = this.bank.frames.get(key);
    if (!f) return false;
    const s = 1 / f.res;
    const left = img.x - (img.flipX ? f.w - f.ax : f.ax) * s;
    const top = img.y - f.ay * s;
    let px = (wx - left) / s;
    const py = (wy - top) / s;
    if (img.flipX) px = f.w - px;
    return hitMask(f, px, py);
  }

  /** World-space bounds of an image (for culling). */
  bounds(img: Phaser.GameObjects.Image, key: string): { x: number; y: number; w: number; h: number } {
    const f = this.bank.frames.get(key);
    if (!f) return { x: img.x, y: img.y, w: 0, h: 0 };
    const s = 1 / f.res;
    return { x: img.x - (img.flipX ? f.w - f.ax : f.ax) * s, y: img.y - f.ay * s, w: f.w * s, h: f.h * s };
  }

  // ------------------------------------------------------------ sharp zoom

  /** The camera settled at `zz` screen pixels per world pixel. */
  setZoomRes(zz: number): void {
    let want = 0;
    if (this.sharpEnabled && zz > this.bank.res * 1.08) want = STEPS.find((s) => s >= zz * 0.92) ?? STEPS[STEPS.length - 1]!;
    if (want <= this.bank.res) want = 0;
    if (want === this.want) return;
    this.want = want;
    this.lowSince = want ? 0 : performance.now();
    this.refreshVisible();
  }

  /** Switches images to the best copy available and queues missing ones for visible images. */
  refreshVisible(): void {
    for (const [img, u] of this.users) this.refresh(img, u);
  }

  /** Draws queued sharp copies for up to `budgetMs`, then tidies up. Call once per frame. */
  pump(budgetMs: number): void {
    this.seq++;
    if (!this.want && this.sharp.size && this.lowSince && performance.now() - this.lowSince > KEEP_MS) this.dropAll();
    if (this.toFree.size) this.freeUnused();
    if (!this.want || !this.queue.size) return;
    const t0 = performance.now();
    for (const key of this.queue) {
      this.queue.delete(key);
      const want = this.wantFor(key);
      const have = this.sharp.get(key);
      if (!want || (have && have.info.res >= want)) continue;
      this.make(key, want);
      if (performance.now() - t0 > budgetMs) break;
    }
  }

  private wantFor(key: string): number {
    const w = key.startsWith('lot.') ? Math.min(this.want, LOT_MAX) : this.want;
    return w > this.bank.res ? w : 0;
  }

  private pick(key: string, base: FrameInfo): FrameInfo {
    const want = this.wantFor(key);
    if (!want) return base;
    const s = this.sharp.get(key);
    if (s && s.info.res >= want) {
      s.used = this.seq;
      return s.info;
    }
    this.queue.add(key);
    return s?.info ?? base;
  }

  private refresh(img: Phaser.GameObjects.Image, u: User): void {
    const base = this.bank.frames.get(u.key);
    if (!base) return;
    let f = base;
    const want = this.wantFor(u.key);
    if (want) {
      const s = this.sharp.get(u.key);
      if (s) {
        f = s.info;
        s.used = this.seq;
      }
      if ((!s || s.info.res < want) && img.visible) this.queue.add(u.key);
    }
    if (img.texture.key === f.texture && img.frame.name === f.frame) return;
    // Mid-tween images keep their frame; the next refresh catches them.
    if (this.scene.tweens.isTweening(img)) return;
    // keep any extra scale the game applied on top of the frame's own
    this.show(img, f, img.flipX, img.scaleX * u.res);
    u.res = f.res;
  }

  private show(img: Phaser.GameObjects.Image, f: FrameInfo, flip: boolean, mul: number): void {
    img.setTexture(f.texture, f.frame);
    img.setFlipX(flip);
    img.setOrigin(flip ? 1 - f.ax / f.w : f.ax / f.w, f.ay / f.h);
    img.setScale(mul / f.res);
    this.resOf.set(img, f.res);
  }

  /** Scales an image to `k` times its sprite's natural size, whatever resolution it shows. */
  scaleTo(img: Phaser.GameObjects.Image, k: number): void {
    img.setScale(k / (this.resOf.get(img) ?? this.bank.res));
  }

  private make(key: string, res: number): void {
    const out = this.bank.renderAt(key, res);
    if (!out) return;
    const k = key.endsWith('.lit') ? key.slice(0, -4) : key;
    this.store(k, out.base, res);
    if (out.lit) this.store(`${k}.lit`, out.lit, res);
    if (this.pixels > BUDGET) this.evict();
  }

  private store(key: string, r: Rendered | null, res: number): void {
    if (!r || !this.bank.frames.has(key)) return;
    // unique per copy: a replaced copy may still be on screen until a tween ends
    const tex = `hi:${key}@${res}#${++this.made}`;
    if (!this.scene.textures.addCanvas(tex, r.canvas)) return;
    const old = this.sharp.get(key);
    const pixels = r.canvas.width * r.canvas.height;
    const info: FrameInfo = { texture: tex, frame: '__BASE', w: r.canvas.width, h: r.canvas.height, ax: r.ax, ay: r.ay, res, mask: NO_MASK, mw: 0, mh: 0, maskStep: 1 };
    this.sharp.set(key, { info, pixels, used: this.seq });
    this.pixels += pixels - (old?.pixels ?? 0);
    for (const [img, u] of this.users) if (u.key === key) this.refresh(img, u);
    if (old) this.toFree.add(old.info.texture);
  }

  /** Drops the least recently used copies that no visible image needs. */
  private evict(): void {
    const inUse = new Set<string>();
    for (const [img, u] of this.users) if (img.visible) inUse.add(u.key);
    const order = [...this.sharp.entries()].filter(([k]) => !inUse.has(k)).sort((a, b) => a[1].used - b[1].used);
    for (const [key, s] of order) {
      if (this.pixels <= BUDGET * 0.8) break;
      this.drop(key, s);
    }
  }

  private dropAll(): void {
    for (const [key, s] of [...this.sharp]) this.drop(key, s);
    this.lowSince = 0;
  }

  private drop(key: string, s: Sharp): void {
    this.sharp.delete(key);
    this.pixels -= s.pixels;
    for (const [img, u] of this.users) if (u.key === key) this.refresh(img, u);
    this.toFree.add(s.info.texture);
  }

  /** Frees replaced textures once no image shows them any more. */
  private freeUnused(): void {
    const shown = new Set<string>();
    for (const img of this.users.keys()) shown.add(img.texture.key);
    for (const tex of this.toFree) {
      if (shown.has(tex)) continue;
      if (this.scene.textures.exists(tex)) this.scene.textures.remove(tex);
      this.toFree.delete(tex);
    }
  }
}
