// Plant drawing shared by farm crops, flower beds and garden decorations:
// leaves, leafy rosettes, flowers and dense flower patches. Plants are drawn
// upright at a ground point (x, y) in screen space; directions along the
// ground are squashed to half height, like the isometric tiles.
import { hash2 } from '../sim/rng';
import { shade } from './color';
import type { Iso } from './iso';

export const TAU = Math.PI * 2;

/** Deterministic 0..1 noise for a seed and an index. */
export function rnd(seed: number, i = 0): number {
  return hash2(seed, i, 7);
}

/** A pointed leaf from (x, y) to its tip (tx, ty), about `w` px wide. */
export function leaf(c: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, w: number, fill: string, edge: string | null = null): void {
  const dx = tx - x;
  const dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const mx = x + dx * 0.45;
  const my = y + dy * 0.45;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(mx + nx, my + ny, tx, ty);
  c.quadraticCurveTo(mx - nx, my - ny, x, y);
  c.fillStyle = fill;
  c.fill();
  if (edge) {
    c.strokeStyle = edge;
    c.lineWidth = 0.6;
    c.stroke();
  }
}

export interface RosetteOpts {
  /** number of leaves */
  n: number;
  /** leaf length and width in px */
  len: number;
  wid: number;
  /** 0 = leaves lie flat on the ground, 1 = they stand straight up, below 0 = they droop */
  lift: number;
  color: string;
  seed: number;
  /** height of the leaves' base above the ground point */
  base?: number;
  /** a lighter vein on the leaves that face the viewer */
  veins?: boolean;
}

/**
 * Leaves fanning out all round one point, drawn back to front and lit from
 * the top-left. Rows of these read as a full, leafy crop.
 */
export function rosette(c: CanvasRenderingContext2D, x: number, y: number, o: RosetteOpts): void {
  const turn = rnd(o.seed, 99) * TAU;
  const leaves: { a: number; len: number; el: number }[] = [];
  for (let i = 0; i < o.n; i++) {
    const a = turn + (i / o.n) * TAU + (rnd(o.seed, i) - 0.5) * 0.6;
    const lift = Math.max(-0.7, Math.min(1, o.lift + (rnd(o.seed, i + 40) - 0.5) * 0.35));
    leaves.push({ a, len: o.len * (0.8 + 0.4 * rnd(o.seed, i + 80)), el: lift * Math.PI * 0.45 });
  }
  // leaves pointing away from the viewer (up the screen) go first
  leaves.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  const by = y - (o.base ?? 0);
  const edge = shade(o.color, -0.42);
  for (const l of leaves) {
    const flat = Math.cos(l.el);
    const tx = x + Math.cos(l.a) * l.len * flat;
    const ty = by + Math.sin(l.a) * l.len * flat * 0.5 - l.len * Math.sin(l.el);
    const tone = Math.sin(l.a) * 0.13 - Math.cos(l.a) * 0.06 + Math.sin(l.el) * 0.05;
    const fill = shade(o.color, tone);
    leaf(c, x, by, tx, ty, o.wid, fill, edge);
    if (o.veins && Math.sin(l.a) > -0.3) {
      c.strokeStyle = shade(o.color, tone + 0.22);
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(x + (tx - x) * 0.15, by + (ty - by) * 0.15);
      c.lineTo(x + (tx - x) * 0.8, by + (ty - by) * 0.8);
      c.stroke();
    }
  }
}

/** A five-petal flower facing the viewer, `r` px across its petals. */
export function bloom(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, seed = 0, center = '#ffd23f'): void {
  const turn = rnd(seed, 3) * TAU;
  // a darker underside first gives each flower an edge against its neighbours
  for (const [fill, dy] of [[shade(color, -0.28), 0.6], [color, 0]] as const) {
    c.fillStyle = fill;
    for (let p = 0; p < 5; p++) {
      const a = turn + (p / 5) * TAU;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * r * 0.52, y + dy + Math.sin(a) * r * 0.42, r * 0.48, r * 0.38, a, 0, TAU);
      c.fill();
    }
  }
  c.fillStyle = center;
  c.beginPath();
  c.arc(x, y, r * 0.3, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath();
  c.arc(x - r * 0.4, y - r * 0.32, r * 0.16, 0, TAU);
  c.fill();
}

/** A leafy clump crowned with two or three flowers. */
export function flowerClump(c: CanvasRenderingContext2D, x: number, y: number, size: number, colors: readonly string[], seed: number, leafColor = '#4f9d35'): void {
  rosette(c, x, y, { n: 6, len: size * 1.05, wid: size * 0.6, lift: 0.5, color: leafColor, seed });
  const k = 2 + (rnd(seed, 1) > 0.45 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0 : i / (k - 1) - 0.5;
    const fx = x + t * size * 1.25 + (rnd(seed, i + 10) - 0.5) * size * 0.5;
    const fy = y - size * (0.55 + 0.35 * rnd(seed, i + 20)) - (i === 1 ? size * 0.35 : 0);
    bloom(c, fx, fy, size * 0.62, colors[Math.floor(rnd(seed, i + 30) * colors.length)]!, seed + i);
  }
}

/**
 * Fills a ground rectangle (tile units, at height z) with a lattice of flower
 * clumps, back to front, so the patch looks packed with flowers.
 */
export function flowerPatch(c: CanvasRenderingContext2D, iso: Iso, x0: number, y0: number, w: number, d: number, z: number, colors: readonly string[], grid: number, seed: number, size: number): void {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const fx = x0 + (w * (i + 0.5)) / grid + (rnd(seed + i, j) - 0.5) * (w / grid) * 0.5;
      const fy = y0 + (d * (j + 0.5)) / grid + (rnd(seed + j, i + 50) - 0.5) * (d / grid) * 0.5;
      pts.push([fx, fy, i * grid + j]);
    }
  }
  pts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [fx, fy, i] of pts) {
    const [sx, sy] = iso.p(fx, fy, z);
    flowerClump(c, sx, sy + 1, size * (0.85 + 0.3 * rnd(seed, i + 70)), colors, seed * 31 + i);
  }
}

/** A ribbed pumpkin with a stem, centred at (x, y). */
export function pumpkin(c: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#f08a24'): void {
  const g = c.createRadialGradient(x - r * 0.45, y - r * 0.4, r * 0.15, x, y, r * 1.25);
  g.addColorStop(0, shade(color, 0.28));
  g.addColorStop(1, shade(color, -0.12));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(120,50,10,0.5)';
  c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(x + k * r * 0.8, y, r * 0.35, r * 0.82, 0, 0, TAU);
    c.stroke();
  }
  c.strokeStyle = 'rgba(59,42,30,0.6)';
  c.beginPath();
  c.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, TAU);
  c.stroke();
  c.fillStyle = 'rgba(255,240,200,0.45)';
  c.beginPath();
  c.ellipse(x - r * 0.45, y - r * 0.35, r * 0.3, r * 0.18, -0.4, 0, TAU);
  c.fill();
  c.fillStyle = '#5b7a2b';
  c.fillRect(x - 1, y - r * 0.85 - 3, 2, 4);
}
