// Isometric (2:1 diamond) drawing toolkit for procedural sprites.
//
// Tile space: x grows to the screen's lower-right, y to the lower-left, z is
// height in logical pixels. Light comes from the top-left: top faces are the
// brightest, the left (+y) faces are lit and the right (+x) faces are shaded.
import { shade } from './color';
import { nextLight, pixelScale } from './night';

export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;

export type Pt3 = [number, number, number];
export type Face = 'L' | 'R';

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface BoxColors {
  top: string;
  left: string;
  right: string;
}

export function boxColors(base: string, topLight = 0.14, rightDark = -0.22): BoxColors {
  return { top: shade(base, topLight), left: base, right: shade(base, rightDark) };
}

export class Iso {
  /** Default outline used around shapes (thin, warm dark). */
  outline = 'rgba(59,42,30,0.55)';
  lineWidth = 1;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    /** Screen position of tile (0,0,0). */
    readonly ox: number,
    readonly oy: number,
  ) {}

  p(x: number, y: number, z = 0): [number, number] {
    return [this.ox + (x - y) * HW, this.oy + (x + y) * HH - z];
  }

  path(pts: Pt3[]): void {
    const c = this.ctx;
    c.beginPath();
    pts.forEach(([x, y, z], i) => {
      const [sx, sy] = this.p(x, y, z);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
  }

  poly(pts: Pt3[], fill: string | CanvasGradient | null, stroke: string | null = this.outline, lw = this.lineWidth): void {
    const c = this.ctx;
    this.path(pts);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.lineJoin = 'round';
      c.stroke();
    }
  }

  /** Flat diamond on the ground (or at height z). */
  tile(x: number, y: number, w: number, d: number, fill: string, stroke: string | null = null, z = 0): void {
    this.poly([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill, stroke);
  }

  /** Draws the three visible faces of a box. */
  box(b: Box, colors: BoxColors | string, stroke: string | null = this.outline): void {
    const c = typeof colors === 'string' ? boxColors(colors) : colors;
    const { x, y, z, w, d, h } = b;
    // left face (+y side)
    this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], c.left, stroke);
    // right face (+x side)
    this.poly([[x + w, y + d, z], [x + w, y, z], [x + w, y, z + h], [x + w, y + d, z + h]], c.right, stroke);
    // top
    this.poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], c.top, stroke);
  }

  /** Soft ground shadow cast towards +x (light from the top-left). */
  shadow(b: { x: number; y: number; w: number; d: number }, height: number, alpha = 0.22): void {
    const len = Math.min(2.2, 0.35 + height / 70);
    const { x, y, w, d } = b;
    this.poly(
      [[x, y + d, 0], [x + w, y + d, 0], [x + w + len, y + d, 0], [x + w + len, y + len * 0.15, 0], [x + w, y, 0], [x, y, 0]],
      `rgba(25,35,15,${alpha})`,
      null,
    );
  }

  /**
   * Runs `fn` with the canvas transformed into the plane of a box face, so
   * flat 2D drawing lands on the wall. Face space: u = 0..faceWidth (32 units
   * per tile, left to right), v = 0..h (top to bottom, in px).
   */
  onFace(b: Box, face: Face, fn: (c: CanvasRenderingContext2D, width: number, height: number) => void): void {
    const c = this.ctx;
    c.save();
    if (face === 'L') {
      const [sx, sy] = this.p(b.x, b.y + b.d, b.z + b.h);
      c.transform(1, 0.5, 0, 1, sx, sy);
      fn(c, b.w * HW, b.h);
    } else {
      const [sx, sy] = this.p(b.x + b.w, b.y + b.d, b.z + b.h);
      c.transform(1, -0.5, 0, 1, sx, sy);
      fn(c, b.d * HW, b.h);
    }
    c.restore();
  }

  /** Runs `fn` in the horizontal plane at height z, origin at tile (x, y): 32 units per tile on both axes. */
  onTop(x: number, y: number, z: number, fn: (c: CanvasRenderingContext2D) => void): void {
    const c = this.ctx;
    c.save();
    const [sx, sy] = this.p(x, y, z);
    c.transform(1, 0.5, -1, 0.5, sx, sy);
    fn(c);
    c.restore();
  }

  /** Gable roof. axis 'x' = ridge runs along x (slopes face +y/-y). */
  gable(b: Box, rise: number, axis: 'x' | 'y', color: string, overhang = 0.12, stroke: string | null = this.outline, wallColor?: string): void {
    const o = overhang;
    const { x, y, z, w, d } = b;
    const zt = z + b.h;
    const lit = color;
    const dark = shade(color, -0.25);
    if (axis === 'x') {
      const ry = y + d / 2;
      // back slope (mostly hidden, drawn first)
      this.poly([[x - o, y - o, zt], [x + w + o, y - o, zt], [x + w + o, ry, zt + rise], [x - o, ry, zt + rise]], dark, stroke);
      // gable end on the +x side (shaded wall)
      this.poly([[x + w, y + d, zt], [x + w, y, zt], [x + w, ry, zt + rise]], shade(wallColor ?? color, wallColor ? -0.22 : -0.1), stroke);
      // front slope (+y, lit)
      this.poly([[x - o, y + d + o, zt], [x + w + o, y + d + o, zt], [x + w + o, ry, zt + rise], [x - o, ry, zt + rise]], lit, stroke);
    } else {
      const rx = x + w / 2;
      this.poly([[x - o, y - o, zt], [x - o, y + d + o, zt], [rx, y + d + o, zt + rise], [rx, y - o, zt + rise]], shade(color, 0.05), stroke);
      // gable end on the +y side (lit wall)
      this.poly([[x, y + d, zt], [x + w, y + d, zt], [rx, y + d, zt + rise]], wallColor ?? shade(color, 0.12), stroke);
      // right slope (+x, shaded)
      this.poly([[x + w + o, y - o, zt], [x + w + o, y + d + o, zt], [rx, y + d + o, zt + rise], [rx, y - o, zt + rise]], dark, stroke);
    }
  }

  /** Hip roof (pyramid when square). */
  hip(b: Box, rise: number, color: string, overhang = 0.12, stroke: string | null = this.outline): void {
    const o = overhang;
    const { x, y, z, w, d } = b;
    const zt = z + b.h + 0.01;
    const X0 = x - o, X1 = x + w + o, Y0 = y - o, Y1 = y + d + o;
    const back = shade(color, -0.32);
    const side = shade(color, -0.24);
    if (w >= d) {
      const r1: Pt3 = [x + d / 2, y + d / 2, zt + rise];
      const r2: Pt3 = [x + w - d / 2, y + d / 2, zt + rise];
      this.poly([[X0, Y0, zt], [X1, Y0, zt], r2, r1], back, stroke);
      this.poly([[X0, Y0, zt], [X0, Y1, zt], r1], shade(color, -0.08), stroke);
      this.poly([[X0, Y1, zt], [X1, Y1, zt], r2, r1], color, stroke);
      this.poly([[X1, Y0, zt], [X1, Y1, zt], r2], side, stroke);
    } else {
      const r1: Pt3 = [x + w / 2, y + w / 2, zt + rise];
      const r2: Pt3 = [x + w / 2, y + d - w / 2, zt + rise];
      this.poly([[X0, Y0, zt], [X1, Y0, zt], r1], back, stroke);
      this.poly([[X0, Y0, zt], [X0, Y1, zt], r2, r1], shade(color, -0.08), stroke);
      this.poly([[X0, Y1, zt], [X1, Y1, zt], r2], color, stroke);
      this.poly([[X1, Y0, zt], [X1, Y1, zt], r2, r1], side, stroke);
    }
  }

  /** Flat roof with a raised parapet rim. */
  flatRoof(b: Box, color: string, rim = 0.18, rimH = 4): void {
    const { x, y, w, d } = b;
    const zt = b.z + b.h;
    this.box({ x, y, z: zt, w, d, h: rimH }, { top: shade(color, 0.2), left: shade(color, 0.05), right: shade(color, -0.2) });
    this.poly(
      [[x + rim, y + rim, zt + rimH], [x + w - rim, y + rim, zt + rimH], [x + w - rim, y + d - rim, zt + rimH], [x + rim, y + d - rim, zt + rimH]],
      shade(color, -0.12),
      null,
    );
  }

  /** Vertical cylinder centred on (cx, cy) with radius r (tiles). */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, color: string, stroke: string | null = this.outline): void {
    const c = this.ctx;
    const [sx, sy] = this.p(cx, cy, z);
    const rx = r * HW * 1.414;
    const ry = rx / 2;
    const grad = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
    grad.addColorStop(0, shade(color, 0.12));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -0.3));
    c.beginPath();
    c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    c.lineTo(sx - rx, sy - h);
    c.ellipse(sx, sy - h, rx, ry, 0, Math.PI, 0, true);
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = this.lineWidth;
      c.stroke();
    }
    c.beginPath();
    c.ellipse(sx, sy - h, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = shade(color, 0.18);
    c.fill();
    if (stroke) c.stroke();
  }

  /** Dome (half ellipsoid) on top of a cylinder radius r at height z. */
  dome(cx: number, cy: number, z: number, r: number, rise: number, color: string, stroke: string | null = this.outline): void {
    const c = this.ctx;
    const [sx, sy] = this.p(cx, cy, z);
    const rx = r * HW * 1.414;
    const ry = rx / 2;
    const grad = c.createRadialGradient(sx - rx * 0.35, sy - rise * 0.7, rx * 0.1, sx, sy - rise * 0.3, rx * 1.2);
    grad.addColorStop(0, shade(color, 0.35));
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, shade(color, -0.3));
    c.beginPath();
    c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    c.bezierCurveTo(sx - rx, sy - rise * 0.9, sx - rx * 0.55, sy - rise * 1.05, sx, sy - rise * 1.05);
    c.bezierCurveTo(sx + rx * 0.55, sy - rise * 1.05, sx + rx, sy - rise * 0.9, sx + rx, sy);
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = this.lineWidth;
      c.stroke();
    }
  }

  /** Cone (spire) */
  cone(cx: number, cy: number, z: number, r: number, h: number, color: string): void {
    const c = this.ctx;
    const [sx, sy] = this.p(cx, cy, z);
    const rx = r * HW * 1.414;
    const ry = rx / 2;
    const grad = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
    grad.addColorStop(0, shade(color, 0.15));
    grad.addColorStop(1, shade(color, -0.3));
    c.beginPath();
    c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    c.lineTo(sx, sy - h);
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = this.outline;
    c.lineWidth = this.lineWidth;
    c.stroke();
  }

  /** Screen-space ellipse shadow blob under small props. */
  blob(x: number, y: number, rTiles: number, alpha = 0.25): void {
    const [sx, sy] = this.p(x, y, 0);
    const c = this.ctx;
    c.beginPath();
    c.ellipse(sx + 3, sy + 1, rTiles * HW * 1.3, rTiles * HH * 1.3, 0, 0, Math.PI * 2);
    c.fillStyle = `rgba(25,35,15,${alpha})`;
    c.fill();
  }
}

// ------------------------------------------------------- face-space helpers --

export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string, lw = 1): void {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.strokeRect(x + 0.5 * lw, y + 0.5 * lw, w - lw, h - lw);
  }
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/** Window with frame, glass gradient and a highlight (warmly lit in the night pass). */
export function windowPane(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame = '#ffffff', glass = '#8fd3f4', arch = false): void {
  const lit = nextLight(0.8);
  c.save();
  c.fillStyle = frame;
  if (arch) {
    c.beginPath();
    c.moveTo(x - 1, y + h + 1);
    c.lineTo(x - 1, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2 + 1, Math.PI, 0);
    c.lineTo(x + w + 1, y + h + 1);
    c.closePath();
    c.fill();
  } else {
    c.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  let g: CanvasGradient;
  if (lit) {
    // warm light from inside, spilling a soft glow onto the wall around it
    g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#fff8d2');
    g.addColorStop(1, '#ffc75e');
    c.shadowColor = 'rgba(255, 186, 76, 0.9)';
    c.shadowBlur = 6 * pixelScale(c);
  } else {
    g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, shade(glass, 0.35));
    g.addColorStop(1, shade(glass, -0.18));
  }
  c.fillStyle = g;
  if (arch) {
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fill();
  } else {
    c.fillRect(x, y, w, h);
  }
  c.shadowBlur = 0;
  c.shadowColor = 'transparent';
  c.fillStyle = lit ? shade(frame, -0.25) : frame;
  c.fillRect(x + w / 2 - 0.5, y + (arch ? w / 3 : 0), 1, h - (arch ? w / 3 : 0));
  if (h > 7) c.fillRect(x, y + h / 2 - 0.5, w, 1);
  if (!lit) {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(x + 1, y + 1, Math.max(1, w * 0.25), Math.max(1, h * 0.3));
  }
  c.restore();
}

export function door(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, arch = true): void {
  c.save();
  c.fillStyle = shade(color, -0.35);
  c.beginPath();
  if (arch) {
    c.moveTo(x - 1, y + h);
    c.lineTo(x - 1, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2 + 1, Math.PI, 0);
    c.lineTo(x + w + 1, y + h);
  } else {
    c.rect(x - 1, y - 1, w + 2, h + 1);
  }
  c.closePath();
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  if (arch) {
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w, y + h);
  } else {
    c.rect(x, y, w, h);
  }
  c.closePath();
  c.fill();
  c.fillStyle = '#f6d36b';
  c.beginPath();
  c.arc(x + w * 0.78, y + h * 0.58, Math.max(0.8, w * 0.08), 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Striped awning that juts out from a face (drawn in face space). */
export function awning(c: CanvasRenderingContext2D, x: number, y: number, w: number, drop: number, colors: [string, string], stripes = 6): void {
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    c.fillStyle = colors[i % 2]!;
    c.beginPath();
    c.moveTo(x + i * sw, y);
    c.lineTo(x + (i + 1) * sw, y);
    c.lineTo(x + (i + 1) * sw + 2, y + drop);
    c.lineTo(x + i * sw + 2, y + drop);
    c.closePath();
    c.fill();
  }
  // scalloped edge
  for (let i = 0; i < stripes; i++) {
    c.fillStyle = colors[i % 2]!;
    c.beginPath();
    c.arc(x + i * sw + sw / 2 + 2, y + drop, sw / 2, 0, Math.PI);
    c.fill();
  }
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(x + 2, y + drop + sw / 2, w, 1.5);
}
