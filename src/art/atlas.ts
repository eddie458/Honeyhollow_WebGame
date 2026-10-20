// Sprite bank: procedural sprites are drawn into offscreen canvases, trimmed,
// given a low-res alpha mask for pixel-accurate picking, then shelf-packed
// into a few large atlas textures (so the GPU can batch draws). Each drawn
// sprite keeps its recipe, so it can be redrawn sharper when the camera zooms
// in (see Sprites), and sprites with lights get a ".lit" night layer.
import { night, startSprite } from './night';

/** How to draw a sprite: logical size, logical anchor and the drawing code. */
export interface Recipe {
  w: number;
  h: number;
  ax: number;
  ay: number;
  fn: (c: CanvasRenderingContext2D) => void;
}

/** A trimmed canvas with its anchor in texture pixels. */
export interface Rendered {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
}

export interface FrameInfo {
  /** Phaser texture key of the atlas page. */
  texture: string;
  /** Frame name inside the atlas page. */
  frame: string;
  /** Size in texture pixels. */
  w: number;
  h: number;
  /** Anchor (the iso origin point) in texture pixels from the frame's top-left. */
  ax: number;
  ay: number;
  /** Texture pixels per logical pixel. */
  res: number;
  mask: Uint8Array;
  mw: number;
  mh: number;
  maskStep: number;
}

interface Pending {
  key: string;
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
  mask: Uint8Array;
  mw: number;
  mh: number;
}

export const MASK_STEP = 3;
const PAGE = 2048;
// Room between packed sprites, so mipmapped (zoomed-out) sampling doesn't bleed.
const PAD = 4;

export class SpriteBank {
  readonly frames = new Map<string, FrameInfo>();
  private pending: Pending[] = [];
  private pages: HTMLCanvasElement[] = [];
  private readonly recipes = new Map<string, Recipe>();

  constructor(readonly res: number) {}

  has(key: string): boolean {
    return this.frames.has(key) || this.pending.some((p) => p.key === key);
  }

  get(key: string): FrameInfo | undefined {
    return this.frames.get(key);
  }

  /** Sprites with lights; their ".lit" night layers are drawn later by drawLit(). */
  readonly withLights = new Set<string>();

  /**
   * Draws a sprite. `w`/`h` are logical sizes, (ax, ay) the logical anchor.
   * `fn` draws in logical pixels.
   */
  draw(key: string, w: number, h: number, ax: number, ay: number, fn: (c: CanvasRenderingContext2D) => void): void {
    const recipe: Recipe = { w, h, ax, ay, fn };
    this.recipes.set(key, recipe);
    startSprite(key);
    const base = drawPass(recipe, this.res, false);
    if (night.lights > 0) this.withLights.add(key);
    this.addCanvas(key, base, ax * this.res, ay * this.res);
  }

  /**
   * Draws the night layer `${key}.lit` of a sprite with lights into the
   * pending list (pack() turns it into a texture page). Kept out of start-up:
   * it costs a second drawing pass plus a pixel comparison per sprite.
   */
  drawLit(key: string): void {
    const r = this.recipes.get(key);
    if (!r || this.frames.has(`${key}.lit`)) return;
    const out = paint(key, r, this.res);
    if (out.lit) this.addCanvas(`${key}.lit`, out.lit, r.ax * this.res, r.ay * this.res);
  }

  /** Whether a sprite (or the sprite a ".lit" layer belongs to) can be redrawn at another resolution. */
  canRender(key: string): boolean {
    return this.recipes.has(recipeKey(key));
  }

  /** Redraws a sprite and its night layer at `res` texture pixels per logical pixel. */
  renderAt(key: string, res: number): { base: Rendered | null; lit: Rendered | null } | null {
    const k = recipeKey(key);
    const r = this.recipes.get(k);
    if (!r) return null;
    const out = paint(k, r, res);
    return { base: trimmed(out.base, r.ax * res, r.ay * res), lit: out.lit ? trimmed(out.lit, r.ax * res, r.ay * res) : null };
  }

  /** Adds an already-rendered canvas (texture pixels) with its anchor. */
  addCanvas(key: string, canvas: HTMLCanvasElement, ax: number, ay: number): void {
    // One pixel readback per sprite: trim bounds and the hit mask both come from it.
    const t = trimAndMask(canvas);
    if (!t) {
      // Fully transparent: keep a 1x1 placeholder.
      const one = document.createElement('canvas');
      one.width = one.height = 1;
      this.pending.push({ key, canvas: one, ax: 0, ay: 0, mask: new Uint8Array(1), mw: 1, mh: 1 });
      return;
    }
    this.pending.push({ key, canvas: t.canvas, ax: ax - t.x, ay: ay - t.y, mask: t.mask, mw: t.mw, mh: t.mh });
  }

  /** Packs pending canvases into pages and returns new pages for registration. */
  pack(prefix: string): { key: string; canvas: HTMLCanvasElement; frames: { name: string; x: number; y: number; w: number; h: number }[] }[] {
    const items = this.pending.sort((a, b) => b.canvas.height - a.canvas.height || b.canvas.width - a.canvas.width);
    this.pending = [];
    const out: ReturnType<SpriteBank['pack']> = [];
    let page: HTMLCanvasElement | null = null;
    let pc: CanvasRenderingContext2D | null = null;
    let cur: (typeof out)[number] | null = null;
    let x = PAD;
    let y = PAD;
    let shelf = 0;
    const newPage = () => {
      page = document.createElement('canvas');
      page.width = PAGE;
      page.height = PAGE;
      pc = page.getContext('2d')!;
      cur = { key: `${prefix}${this.pages.length}`, canvas: page, frames: [] };
      this.pageByKey.set(cur.key, page);
      this.pages.push(page);
      out.push(cur);
      x = PAD;
      y = PAD;
      shelf = 0;
    };
    for (const it of items) {
      const w = it.canvas.width;
      const h = it.canvas.height;
      if (w > PAGE - PAD * 2 || h > PAGE - PAD * 2) {
        // Oversized sprite: gets its own page sized to fit.
        const solo = document.createElement('canvas');
        solo.width = w;
        solo.height = h;
        solo.getContext('2d')!.drawImage(it.canvas, 0, 0);
        const key = `${prefix}${this.pages.length}`;
        this.pages.push(solo);
        this.pageByKey.set(key, solo);
        this.framePos.set(it.key, { x: 0, y: 0 });
        out.push({ key, canvas: solo, frames: [{ name: it.key, x: 0, y: 0, w, h }] });
        this.register(it, key, w, h);
        continue;
      }
      if (!page) newPage();
      if (x + w + PAD > PAGE) {
        x = PAD;
        y += shelf + PAD;
        shelf = 0;
      }
      if (y + h + PAD > PAGE) newPage();
      pc!.drawImage(it.canvas, x, y);
      cur!.frames.push({ name: it.key, x, y, w, h });
      this.framePos.set(it.key, { x, y });
      this.register(it, cur!.key, w, h);
      x += w + PAD;
      shelf = Math.max(shelf, h);
    }
    return out;
  }

  private register(it: Pending, texture: string, w: number, h: number): void {
    this.frames.set(it.key, { texture, frame: it.key, w, h, ax: it.ax, ay: it.ay, res: this.res, mask: it.mask, mw: it.mw, mh: it.mh, maskStep: MASK_STEP });
  }

  /** A scaled copy of a frame for HTML thumbnails (build menu). */
  thumb(key: string, maxW: number, maxH: number, sources: Map<string, CanvasImageSource>): HTMLCanvasElement | null {
    const f = this.frames.get(key);
    if (!f) return null;
    const src = sources.get(f.texture) ?? this.pageByKey.get(f.texture);
    if (!src) return null;
    const pos = this.framePos.get(key);
    if (!pos) return null;
    const scale = Math.min(maxW / f.w, maxH / f.h, 1.5 / f.res) * Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(f.w * scale));
    c.height = Math.max(1, Math.round(f.h * scale));
    c.style.width = `${c.width / Math.min(2, window.devicePixelRatio || 1)}px`;
    c.getContext('2d')!.drawImage(src, pos.x, pos.y, f.w, f.h, 0, 0, c.width, c.height);
    return c;
  }

  readonly pageByKey = new Map<string, HTMLCanvasElement>();
  readonly framePos = new Map<string, { x: number; y: number }>();

  /** Registers an externally loaded image (asset manifest override). */
  registerExternal(key: string, texture: string, frame: string, source: HTMLCanvasElement, ax: number, ay: number, res: number): void {
    const { mask, mw, mh } = buildMask(source);
    this.frames.set(key, { texture, frame, w: source.width, h: source.height, ax, ay, res, mask, mw, mh, maskStep: MASK_STEP });
  }
}

/** ".lit" layers are drawn by the recipe of the sprite they belong to. */
function recipeKey(key: string): string {
  return key.endsWith('.lit') ? key.slice(0, -4) : key;
}

/** Draws a recipe by day and, if it has lights, again by night (untrimmed canvases). */
function paint(key: string, r: Recipe, res: number): { base: HTMLCanvasElement; lit: HTMLCanvasElement | null } {
  startSprite(key);
  const base = drawPass(r, res, false);
  if (night.lights === 0) return { base, lit: null };
  startSprite(key);
  const lit = litLayer(base, drawPass(r, res, true));
  return { base, lit };
}

function drawPass(r: Recipe, res: number, nightPass: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(r.w * res));
  canvas.height = Math.max(1, Math.ceil(r.h * res));
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.scale(res, res);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  night.on = nightPass;
  try {
    r.fn(c);
  } finally {
    night.on = false;
  }
  return canvas;
}

/**
 * Keeps the night pixels that differ from the day pass. Pixels that changed a
 * lot (lit glass) stay opaque; faint changes (glow spilling onto a wall) fade
 * out, so the layer blends into the darkened sprite without hard edges.
 */
function litLayer(day: HTMLCanvasElement, nightCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const W = day.width;
  const H = day.height;
  const a = day.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const nc = nightCanvas.getContext('2d', { willReadFrequently: true })!;
  const img = nc.getImageData(0, 0, W, H);
  const b = img.data;
  let any = false;
  for (let i = 0; i < b.length; i += 4) {
    const a1 = a[i + 3]! / 255;
    const a2 = b[i + 3]! / 255;
    const d = Math.max(
      Math.abs(b[i]! * a2 - a[i]! * a1),
      Math.abs(b[i + 1]! * a2 - a[i + 1]! * a1),
      Math.abs(b[i + 2]! * a2 - a[i + 2]! * a1),
      Math.abs(b[i + 3]! - a[i + 3]!),
    );
    if (d < 4) {
      b[i + 3] = 0;
      continue;
    }
    b[i + 3] = Math.min(b[i + 3]!, Math.round(d * 4));
    any = true;
  }
  if (!any) return null;
  nc.putImageData(img, 0, 0);
  return nightCanvas;
}

function trimmed(canvas: HTMLCanvasElement, ax: number, ay: number): Rendered | null {
  const t = trimAndMask(canvas);
  return t ? { canvas: t.canvas, ax: ax - t.x, ay: ay - t.y } : null;
}

function trimAndMask(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; x: number; y: number; mask: Uint8Array; mw: number; mh: number } | null {
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width: W, height: H } = canvas;
  const data = c.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    let row = y * W * 4 + 3;
    for (let x = 0; x < W; x++, row += 4) {
      if (data[row]! > 4) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mw = Math.ceil(w / MASK_STEP);
  const mh = Math.ceil(h / MASK_STEP);
  const mask = new Uint8Array(mw * mh);
  for (let my = 0; my < mh; my++) {
    for (let mx = 0; mx < mw; mx++) {
      const px = Math.min(W - 1, minX + mx * MASK_STEP + 1);
      const py = Math.min(H - 1, minY + my * MASK_STEP + 1);
      mask[my * mw + mx] = data[(py * W + px) * 4 + 3]! > 40 ? 1 : 0;
    }
  }
  if (w === W && h === H) return { canvas, x: 0, y: 0, mask, mw, mh };
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return { canvas: out, x: minX, y: minY, mask, mw, mh };
}

function buildMask(canvas: HTMLCanvasElement): { mask: Uint8Array; mw: number; mh: number } {
  const W = canvas.width;
  const H = canvas.height;
  const mw = Math.ceil(W / MASK_STEP);
  const mh = Math.ceil(H / MASK_STEP);
  const mask = new Uint8Array(mw * mh);
  const c = canvas.getContext('2d', { willReadFrequently: true });
  if (!c) return { mask: mask.fill(1), mw, mh };
  const data = c.getImageData(0, 0, W, H).data;
  for (let my = 0; my < mh; my++) {
    for (let mx = 0; mx < mw; mx++) {
      const px = Math.min(W - 1, mx * MASK_STEP + 1);
      const py = Math.min(H - 1, my * MASK_STEP + 1);
      mask[my * mw + mx] = data[(py * W + px) * 4 + 3]! > 40 ? 1 : 0;
    }
  }
  return { mask, mw, mh };
}

/** Alpha test at frame-local texture pixel coordinates. */
export function hitMask(f: FrameInfo, px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= f.w || py >= f.h) return false;
  const mx = Math.floor(px / f.maskStep);
  const my = Math.floor(py / f.maskStep);
  return f.mask[my * f.mw + mx] === 1;
}
