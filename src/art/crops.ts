// Farm plots: a raised bed of tilled soil that fills with rows of crops as
// they grow - seedlings on the furrows, then leafy plants, then a full field
// of ripe fruit where the whole bed is covered.
import { PAL, shade } from './color';
import { TAU, bloom, leaf, pumpkin, rnd, rosette } from './flora';
import { Iso } from './iso';
import { pixelScale } from './night';
import { frameFor } from './terrain';
import type { SpriteBank } from './atlas';

export interface CropArt {
  leaf: string;
  fruit: string;
  shape: 'berry' | 'pod' | 'melon' | 'carrot' | 'bush' | 'pumpkin' | 'corn' | 'wheat';
}

export const CROP_ART: Record<string, CropArt> = {
  strawberry: { leaf: '#3f9a3a', fruit: '#e8384f', shape: 'berry' },
  eggplant: { leaf: '#4c8f3b', fruit: '#6a3b8f', shape: 'pod' },
  watermelon: { leaf: '#4a9b3c', fruit: '#2e7d32', shape: 'melon' },
  carrot: { leaf: '#5cb043', fruit: '#f28c28', shape: 'carrot' },
  cranberry: { leaf: '#3d7f3a', fruit: '#a3172e', shape: 'bush' },
  pumpkin: { leaf: '#4f8f3a', fruit: '#f08a24', shape: 'pumpkin' },
  corn: { leaf: '#6aa84f', fruit: '#f6d34a', shape: 'corn' },
  wheat: { leaf: '#c9a64a', fruit: '#e9c46a', shape: 'wheat' },
};

/** The soil bed, in tile units; plants stand on its top at SOIL_Z. */
const BED = { x: 0.05, y: 0.05, w: 2.9, d: 2.9 };
const SOIL_Z = 3;
/** Growing plants are this fraction of their ripe size. */
const GROWING = 0.8;

function plotBase(iso: Iso): void {
  iso.box({ ...BED, z: 0, h: SOIL_Z }, { top: PAL.soil, left: shade(PAL.soil, -0.15), right: shade(PAL.soil, -0.3) }, 'rgba(60,35,15,0.5)');
  iso.onTop(BED.x, BED.y, SOIL_Z, (t) => {
    for (let i = 0; i < 6; i++) {
      t.fillStyle = PAL.soilDark;
      t.fillRect(4, 6 + i * 15.5, 85, 4);
      t.fillStyle = 'rgba(255,220,180,0.12)';
      t.fillRect(4, 10 + i * 15.5, 85, 2);
    }
  });
}

interface Spot {
  sx: number;
  sy: number;
  seed: number;
}

/** Plant positions: `rows` rows (along x) of `cols` plants, back to front. */
function spots(iso: Iso, cols: number, rows: number, salt: number, jitter = 0.05): Spot[] {
  const out: (Spot & { depth: number })[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const seed = salt * 1000 + i * 31 + j;
      const x = BED.x + (BED.w * (i + 0.5)) / cols + (rnd(seed, 1) - 0.5) * 2 * jitter;
      const y = BED.y + (BED.d * (j + 0.5)) / rows + (rnd(seed, 2) - 0.5) * 2 * jitter;
      const [sx, sy] = iso.p(x, y, SOIL_Z);
      out.push({ sx, sy: sy + 1, seed, depth: x + y });
    }
  }
  return out.sort((a, b) => a.depth - b.depth);
}

/** stage: 0 empty, 1 seeded, 2 growing, 3 ripe, 4 withered */
export function drawPlot(bank: SpriteBank, key: string, crop: CropArt | null, stage: number): void {
  // tall corn needs headroom above the back corner; empty space is trimmed away
  const f = frameFor(3, 3, 64, 12, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    plotBase(iso);
    if (stage === 1) seedlings(c, iso, crop);
    else if (stage === 4) withered(c, iso);
    else if ((stage === 2 || stage === 3) && crop) field(c, iso, crop, stage === 3);
  });
}

type PlantFn = (c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean) => void;

/** How each crop is planted: plants per row, rows, the plant, and a seed. */
const LAYOUT: Record<CropArt['shape'], readonly [number, number, PlantFn, number]> = {
  berry: [5, 5, strawberryPlant, 11],
  bush: [5, 5, cranberryPlant, 12],
  pod: [4, 4, eggplantPlant, 13],
  melon: [4, 4, melonPlant, 14],
  pumpkin: [4, 4, pumpkinPlant, 15],
  carrot: [6, 5, carrotPlant, 16],
  corn: [6, 6, cornPlant, 17],
  wheat: [7, 6, wheatTuft, 18],
};

/** Room for one plant (logical px), with its ground point at (STAMP_AX, STAMP_AY). */
const STAMP_W = 76;
const STAMP_H = 76;
const STAMP_AX = 38;
const STAMP_AY = 62;
const VARIANTS = 5;

/**
 * Fills the bed. A few plant variants are drawn once at this sprite's
 * resolution and then stamped onto every spot, back to front: a full field
 * costs about as much to draw as five plants.
 */
function field(c: CanvasRenderingContext2D, iso: Iso, a: CropArt, ripe: boolean): void {
  const [cols, rows, plant, salt] = LAYOUT[a.shape];
  const s = ripe ? 1 : GROWING;
  const res = pixelScale(c);
  const stamps: HTMLCanvasElement[] = [];
  for (let v = 0; v < VARIANTS; v++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(STAMP_W * res);
    canvas.height = Math.ceil(STAMP_H * res);
    // a CPU canvas like the sprite's own (see drawPass), so copying it is cheap
    const sc = canvas.getContext('2d', { willReadFrequently: true })!;
    sc.scale(res, res);
    sc.lineCap = 'round';
    sc.lineJoin = 'round';
    plant(sc, { sx: STAMP_AX, sy: STAMP_AY, seed: salt * 1000 + 700 + v * 13 }, a, s, ripe);
    stamps.push(canvas);
  }
  for (const p of spots(iso, cols, rows, salt)) {
    const stamp = stamps[Math.floor(rnd(p.seed, 77) * VARIANTS)]!;
    // whole texture pixels, so each stamp is copied without blurring
    const x = Math.round((p.sx - STAMP_AX) * res) / res;
    const y = Math.round((p.sy - STAMP_AY) * res) / res;
    c.drawImage(stamp, x, y, STAMP_W, STAMP_H);
  }
}

function groundShadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = 'rgba(40,22,8,0.28)';
  c.beginPath();
  c.ellipse(x + rx * 0.15, y + ry * 0.2, rx, ry, 0, 0, TAU);
  c.fill();
}

// ---------------------------------------------------------------- seedlings

/** Rows of sprouts along the furrows (the same for every crop, bar grasses). */
function seedlings(c: CanvasRenderingContext2D, iso: Iso, crop: CropArt | null): void {
  const grass = crop?.shape === 'corn' || crop?.shape === 'wheat';
  const pts: { sx: number; sy: number; seed: number; depth: number }[] = [];
  for (let j = 0; j < 6; j++) {
    // the furrow centres drawn by plotBase
    const y = BED.y + (8 + 15.5 * j) / 32;
    for (let i = 0; i < 7; i++) {
      const seed = 500 + j * 7 + i;
      const x = BED.x + 0.24 + i * 0.405 + (rnd(seed, 1) - 0.5) * 0.08;
      const [sx, sy] = iso.p(x, y, SOIL_Z);
      pts.push({ sx, sy: sy + 1, seed, depth: x + y });
    }
  }
  pts.sort((a, b) => a.depth - b.depth);
  for (const p of pts) {
    c.fillStyle = PAL.soilDark;
    c.beginPath();
    c.ellipse(p.sx, p.sy, 4.2, 1.9, 0, 0, TAU);
    c.fill();
    if (grass) {
      c.strokeStyle = '#78b845';
      c.lineWidth = 1.1;
      c.lineCap = 'round';
      c.beginPath();
      for (const [dx, h] of [[-2.2, 6], [0, 8.5], [2.2, 6.5]] as const) {
        c.moveTo(p.sx + dx * 0.3, p.sy - 0.5);
        c.lineTo(p.sx + dx, p.sy - h - rnd(p.seed, dx + 3) * 2);
      }
      c.stroke();
    } else {
      c.strokeStyle = '#5a9a35';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(p.sx, p.sy - 0.5);
      c.lineTo(p.sx, p.sy - 3.5);
      c.stroke();
      leaf(c, p.sx, p.sy - 3.5, p.sx - 4.8, p.sy - 6.5, 3.2, '#7fbf4a', '#4f8a2e');
      leaf(c, p.sx, p.sy - 3.5, p.sx + 4.8, p.sy - 7.2, 3.2, '#92cf5a', '#4f8a2e');
    }
  }
}

// ---------------------------------------------------------------- withered

function withered(c: CanvasRenderingContext2D, iso: Iso): void {
  for (const p of spots(iso, 5, 5, 41, 0.07)) {
    groundShadow(c, p.sx, p.sy, 9, 3.5);
    rosette(c, p.sx, p.sy, { n: 4, len: 9, wid: 4.5, lift: 0.05, color: '#8b6a3e', seed: p.seed + 3 });
    const tx = p.sx + (rnd(p.seed, 1) - 0.5) * 7;
    const ty = p.sy - 9 - rnd(p.seed, 2) * 4;
    c.strokeStyle = '#7d5f36';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(p.sx, p.sy);
    c.quadraticCurveTo(p.sx + 1, p.sy - 6, tx, ty);
    c.stroke();
    // limp leaves hanging from the top of the bent stalk
    rosette(c, tx, ty, { n: 5, len: 9, wid: 4.5, lift: -0.4, color: '#a3804d', seed: p.seed });
  }
}

// ---------------------------------------------------------------- berries

const SEEDS: readonly (readonly [number, number])[] = [[-0.45, -0.05], [0.42, -0.1], [0, 0.3], [-0.22, 0.72], [0.28, 0.62]];

function strawberry(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.beginPath();
  c.moveTo(x, y + r * 1.3);
  c.bezierCurveTo(x - r * 1.45, y + r * 0.35, x - r * 1.05, y - r * 1.05, x, y - r * 0.72);
  c.bezierCurveTo(x + r * 1.05, y - r * 1.05, x + r * 1.45, y + r * 0.35, x, y + r * 1.3);
  const g = c.createRadialGradient(x - r * 0.45, y - r * 0.45, r * 0.2, x, y, r * 1.6);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(1, shade(color, -0.2));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = shade(color, -0.5);
  c.lineWidth = 0.6;
  c.stroke();
  c.fillStyle = '#ffe9a0';
  for (const [u, v] of SEEDS) c.fillRect(x + u * r - 0.35, y + v * r - 0.35, 0.7, 0.7);
  c.fillStyle = '#3d8a2c';
  c.beginPath();
  c.ellipse(x, y - r * 0.72, r * 0.8, r * 0.32, 0, 0, TAU);
  c.fill();
}

function roundBerry(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.fillStyle = shade(color, -0.35);
  c.beginPath();
  c.arc(x, y + 0.45, r, 0, TAU);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.65)';
  c.beginPath();
  c.arc(x - r * 0.35, y - r * 0.4, r * 0.32, 0, TAU);
  c.fill();
}

function strawberryPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 14 * s, 5.5 * s);
  rosette(c, p.sx, p.sy, { n: 9, len: 16 * s, wid: 8.5 * s, lift: 0.42, color: a.leaf, seed: p.seed, veins: true });
  if (ripe) {
    const at: readonly (readonly [number, number])[] = [[-9, -3], [8, -4], [-3, 1], [4, -10], [11, 0], [-6, -10]];
    at.forEach(([dx, dy], k) => {
      if (k > 2 && rnd(p.seed, k + 5) < 0.35) return;
      strawberry(c, p.sx + dx + (rnd(p.seed, k + 20) - 0.5) * 2, p.sy + dy, 3.2, a.fruit);
    });
  } else {
    bloom(c, p.sx - 5, p.sy - 8, 3.8, '#ffffff', p.seed);
    bloom(c, p.sx + 5, p.sy - 6, 3.4, '#fff6f0', p.seed + 1);
    roundBerry(c, p.sx + 1, p.sy - 2, 1.6, '#9bc45a');
  }
}

function cranberryPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 13 * s, 5 * s);
  // a dark core keeps the low shrub dense between its small leaves
  c.fillStyle = shade(a.leaf, -0.3);
  c.beginPath();
  c.ellipse(p.sx, p.sy - 5 * s, 10.5 * s, 6.5 * s, 0, 0, TAU);
  c.fill();
  rosette(c, p.sx, p.sy, { n: 14, len: 14 * s, wid: 5.5 * s, lift: 0.6, color: a.leaf, seed: p.seed });
  if (ripe) {
    for (let k = 0; k < 9; k++) {
      const ang = rnd(p.seed, k + 30) * TAU;
      const rr = 0.3 + 0.7 * rnd(p.seed, k + 50);
      roundBerry(c, p.sx + Math.cos(ang) * 10 * rr, p.sy - 6 + Math.sin(ang) * 5.5 * rr, 2.2, a.fruit);
    }
  } else {
    for (let k = 0; k < 3; k++) bloom(c, p.sx + (k - 1) * 6, p.sy - 7 - (k % 2) * 3, 2.8, '#f7b6c8', p.seed + k, '#ffe08a');
  }
}

// ---------------------------------------------------------------- eggplant

function eggplant(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, tilt: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(w * 0.75, h * 0.1, w * 0.85, h * 0.95, 0, h);
  c.bezierCurveTo(-w * 0.85, h * 0.95, -w * 0.75, h * 0.1, 0, 0);
  const g = c.createLinearGradient(-w * 0.6, 0, w * 0.6, 0);
  g.addColorStop(0, shade(color, 0.32));
  g.addColorStop(1, shade(color, -0.3));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = shade(color, -0.55);
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = w * 0.16;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-w * 0.26, h * 0.42);
  c.quadraticCurveTo(-w * 0.4, h * 0.62, -w * 0.24, h * 0.82);
  c.stroke();
  // green cap
  c.fillStyle = '#5a8f3a';
  c.beginPath();
  c.moveTo(-w * 0.6, h * 0.2);
  c.quadraticCurveTo(0, -h * 0.08, w * 0.6, h * 0.2);
  c.lineTo(w * 0.18, h * 0.32);
  c.lineTo(0, h * 0.25);
  c.lineTo(-w * 0.18, h * 0.32);
  c.closePath();
  c.fill();
  c.restore();
}

function eggplantPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 17 * s, 6.5 * s);
  rosette(c, p.sx, p.sy, { n: 8, len: 20 * s, wid: 10.5 * s, lift: 0.5, color: a.leaf, seed: p.seed, veins: true });
  rosette(c, p.sx, p.sy, { n: 4, len: 13 * s, wid: 8 * s, lift: 0.95, color: shade(a.leaf, 0.06), seed: p.seed + 1, base: 4 * s, veins: true });
  if (ripe) {
    const hang: readonly (readonly [number, number, number])[] = [[-9, -10, -0.28], [9, -11, 0.28], [1, -6, 0.05]];
    for (const [dx, dy, tilt] of hang) eggplant(c, p.sx + dx, p.sy + dy, 5.6, 13, a.fruit, tilt);
  } else {
    bloom(c, p.sx - 4, p.sy - 12, 3.4, '#b98cf0', p.seed);
    bloom(c, p.sx + 5, p.sy - 9, 3.1, '#c9a3f5', p.seed + 1);
    eggplant(c, p.sx + 1, p.sy - 6, 2.8, 6.5, a.fruit, 0.1);
  }
}

// ------------------------------------------------------- melons, pumpkins

function melon(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  const g = c.createRadialGradient(-rx * 0.35, -ry * 0.45, ry * 0.2, 0, 0, rx);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(1, shade(color, -0.15));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.fill();
  // pale wavy stripes from end to end, following the round shape
  c.save();
  c.clip();
  c.strokeStyle = 'rgba(170,225,125,0.6)';
  c.lineWidth = Math.max(0.9, ry * 0.2);
  for (let k = -2; k <= 2; k++) {
    c.beginPath();
    for (let u = -rx; u <= rx + 0.01; u += rx / 6) {
      const yy = (k / 2.5) * ry * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2)) + Math.sin(u * 1.4 + k) * ry * 0.07;
      if (u === -rx) c.moveTo(u, yy);
      else c.lineTo(u, yy);
    }
    c.stroke();
  }
  c.restore();
  c.strokeStyle = shade(color, -0.5);
  c.lineWidth = 0.8;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.beginPath();
  c.ellipse(-rx * 0.4, -ry * 0.45, rx * 0.28, ry * 0.18, -0.2, 0, TAU);
  c.fill();
  c.restore();
}

function melonPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 18 * s, 7 * s);
  rosette(c, p.sx, p.sy, { n: 7, len: 20 * s, wid: 14 * s, lift: 0.16, color: a.leaf, seed: p.seed, veins: true });
  if (ripe) melon(c, p.sx + 2, p.sy - 4, 11, 7.2, rnd(p.seed, 3) > 0.5 ? 0.42 : -0.42, a.fruit);
  else {
    melon(c, p.sx + 2, p.sy - 3, 4.8, 3.2, 0.4, '#7cb342');
    bloom(c, p.sx - 4, p.sy - 8, 3.2, '#ffd23f', p.seed, '#f5a623');
  }
}

function pumpkinPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 18 * s, 7 * s);
  rosette(c, p.sx, p.sy, { n: 7, len: 21 * s, wid: 16 * s, lift: 0.22, color: a.leaf, seed: p.seed, veins: true });
  if (ripe) pumpkin(c, p.sx + 2, p.sy - 5, 8, a.fruit);
  else {
    pumpkin(c, p.sx + 2, p.sy - 3, 3.8, '#a8c94e');
    bloom(c, p.sx - 5, p.sy - 9, 3.6, '#ffc93c', p.seed, '#f08a24');
  }
}

// ---------------------------------------------------------------- carrots

/** A feathery carrot frond with little leaflets towards its tip. */
function frond(c: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, s: number, color: string): void {
  c.strokeStyle = color;
  c.lineWidth = 0.9 * s + 0.3;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + (tx - x) * 0.2, y + (ty - y) * 0.6, tx, ty);
  c.stroke();
  c.fillStyle = color;
  c.beginPath();
  for (const u of [0.45, 0.65, 0.85, 1]) {
    const px = x + (tx - x) * u;
    const py = y + (ty - y) * u;
    c.ellipse(px - 1.7 * s, py + 0.4, 2.3 * s, 1.15 * s, -0.5, 0, TAU);
    c.ellipse(px + 1.7 * s, py + 0.4, 2.3 * s, 1.15 * s, 0.5, 0, TAU);
  }
  c.fill();
}

function carrotPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  groundShadow(c, p.sx, p.sy, 9 * s, 3.5 * s);
  if (ripe) {
    // the orange tops of the carrots showing at the soil
    c.fillStyle = shade(a.fruit, -0.2);
    c.beginPath();
    c.ellipse(p.sx, p.sy + 0.6, 3.9, 2.3, 0, 0, TAU);
    c.fill();
    c.fillStyle = a.fruit;
    c.beginPath();
    c.ellipse(p.sx, p.sy - 0.3, 3.6, 2, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,240,200,0.5)';
    c.fillRect(p.sx - 2, p.sy - 1.3, 1.6, 0.8);
  }
  const n = 7;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5;
    const len = (15 + rnd(p.seed, k) * 5) * s;
    const tx = p.sx + t * 22 * s + (rnd(p.seed, k + 9) - 0.5) * 3;
    const ty = p.sy - len * (1 - Math.abs(t) * 0.55);
    frond(c, p.sx + t * 2, p.sy - 1, tx, ty, s, shade(a.leaf, (rnd(p.seed, k + 3) - 0.5) * 0.22 - Math.abs(t) * 0.12));
  }
}

// ------------------------------------------------------------------- corn

/** A long leaf that rises from the stalk and droops at its tip. */
function archLeaf(c: CanvasRenderingContext2D, bx: number, by: number, dir: number, len: number, w: number, fill: string): void {
  const px = bx + dir * len * 0.55;
  const py = by - len * 0.42;
  const tx = bx + dir * len;
  const ty = by - len * 0.05;
  c.beginPath();
  c.moveTo(bx, by - w * 0.5);
  c.quadraticCurveTo(px, py - w * 0.6, tx, ty);
  c.quadraticCurveTo(px, py + w * 0.6, bx, by + w * 0.5);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = shade(fill, -0.38);
  c.lineWidth = 0.5;
  c.stroke();
}

function cob(c: CanvasRenderingContext2D, x: number, y: number, tilt: number, a: CropArt): void {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  const g = c.createLinearGradient(-2.8, 0, 2.8, 0);
  g.addColorStop(0, shade(a.fruit, 0.25));
  g.addColorStop(1, shade(a.fruit, -0.2));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, 2.8, 6.6, 0, 0, TAU);
  c.fill();
  c.strokeStyle = shade(a.fruit, -0.45);
  c.lineWidth = 0.5;
  c.stroke();
  // rows of kernels
  c.fillStyle = shade(a.fruit, -0.25);
  for (let v = -5; v <= 4; v += 1.5) for (const u of [-1.2, 0, 1.2]) c.fillRect(u - 0.3, v - 0.3, 0.6, 0.6);
  // husk leaves wrapping the lower half
  leaf(c, 0, 6.8, -2.6, -1.5, 3, shade(a.leaf, 0.12), shade(a.leaf, -0.35));
  leaf(c, 0, 6.8, 2.4, -0.5, 3, shade(a.leaf, -0.05), shade(a.leaf, -0.35));
  // silk
  c.strokeStyle = '#a0682f';
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(0, -6.4);
  c.lineTo(-1.4, -9);
  c.moveTo(0, -6.4);
  c.lineTo(1.2, -9.3);
  c.stroke();
  c.restore();
}

function cornPlant(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  const H = (36 + rnd(p.seed, 1) * 8) * s;
  const lean = (rnd(p.seed, 2) - 0.5) * 5 * s;
  groundShadow(c, p.sx, p.sy, 10 * s, 4 * s);
  rosette(c, p.sx, p.sy, { n: 5, len: 11 * s, wid: 5 * s, lift: 0.3, color: shade(a.leaf, -0.08), seed: p.seed });
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1;
    const u = 0.1 + k * 0.1;
    const tone = (k % 3) * 0.05 - 0.06 + (side < 0 ? 0.04 : -0.04);
    archLeaf(c, p.sx + lean * u, p.sy - H * u, side * (0.85 + rnd(p.seed, k + 30) * 0.3), (21 - k * 1.5) * s, 5.2 * s, shade(a.leaf, tone));
  }
  c.lineCap = 'round';
  c.strokeStyle = shade(a.leaf, -0.22);
  c.lineWidth = 2.6 * s;
  c.beginPath();
  c.moveTo(p.sx, p.sy);
  c.lineTo(p.sx + lean, p.sy - H);
  c.stroke();
  c.strokeStyle = shade(a.leaf, 0.18);
  c.lineWidth = 0.8 * s;
  c.beginPath();
  c.moveTo(p.sx - 0.6 * s, p.sy);
  c.lineTo(p.sx + lean - 0.6 * s, p.sy - H);
  c.stroke();
  if (ripe) {
    cob(c, p.sx + lean * 0.5 + 3, p.sy - H * 0.48, 0.35, a);
    if (rnd(p.seed, 4) > 0.3) cob(c, p.sx + lean * 0.62 - 3, p.sy - H * 0.62, -0.35, a);
  }
  // tassel
  const tx = p.sx + lean;
  const ty = p.sy - H;
  c.strokeStyle = ripe ? '#d9b25a' : '#a9cf63';
  c.lineWidth = 1.1 * s;
  c.beginPath();
  for (const [dx, dy] of [[-4, -4], [-1.5, -6.5], [1.5, -6], [4, -3.5], [0, -7.5]] as const) {
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + dx * 0.3 * s, ty + dy * 0.7 * s, tx + dx * s, ty + dy * s);
  }
  c.stroke();
}

// ------------------------------------------------------------------ wheat

function grainHead(c: CanvasRenderingContext2D, x: number, y: number, lean: number, s: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(Math.atan(lean));
  c.strokeStyle = shade(color, 0.12);
  c.lineWidth = 0.5;
  c.beginPath();
  for (const ax of [-1.2, 0, 1.2]) {
    c.moveTo(ax * s, -3 * s);
    c.lineTo(ax * 1.8 * s, -8.5 * s);
  }
  c.stroke();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, -2.6 * s, 2 * s, 4.6 * s, 0, 0, TAU);
  c.fill();
  c.strokeStyle = shade(color, -0.35);
  c.beginPath();
  for (let v = -5.5; v <= -0.5; v += 1.6) {
    c.moveTo(-1.5 * s, v * s);
    c.lineTo(0, (v + 0.8) * s);
    c.lineTo(1.5 * s, v * s);
  }
  c.stroke();
  c.restore();
}

function wheatTuft(c: CanvasRenderingContext2D, p: Spot, a: CropArt, s: number, ripe: boolean): void {
  const stem = ripe ? a.leaf : '#7fae45';
  const head = ripe ? a.fruit : '#a9cf63';
  groundShadow(c, p.sx, p.sy, 7 * s, 2.8 * s);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5;
    const h = (20 + rnd(p.seed, k) * 6) * s;
    const bx = p.sx + t * 5 * s;
    const tx = bx + t * 9 * s + (rnd(p.seed, k + 7) - 0.5) * 2.5;
    const ty = p.sy - h;
    c.strokeStyle = shade(stem, (rnd(p.seed, k + 3) - 0.5) * 0.2);
    c.lineWidth = s + 0.2;
    c.beginPath();
    c.moveTo(bx, p.sy);
    c.quadraticCurveTo(bx, p.sy - h * 0.5, tx, ty);
    c.stroke();
    grainHead(c, tx, ty, (tx - bx) / h, s, shade(head, (rnd(p.seed, k + 11) - 0.5) * 0.12));
  }
}
