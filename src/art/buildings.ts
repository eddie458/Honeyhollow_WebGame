// Parametric building generator. Every building is a few iso boxes with a
// roof, facade details drawn in face space, and an oversized identifying prop
// (the "caricature" feature) - parameters come from the asset manifest.
import { PAL, shade } from './color';
import { awning, door, Iso, rect, windowPane, type Box, type Face } from './iso';
import { drawProp, signBoard } from './props';
import { frameFor } from './terrain';
import type { SpriteBank } from './atlas';

export interface BuildingParams {
  style: 'house' | 'shop' | 'civic' | 'barn' | 'silo' | 'warehouse' | 'tower';
  wall: string;
  roof: string;
  roofType?: 'gable' | 'gableSide' | 'hip' | 'flat' | 'dome' | 'gambrel';
  floors?: number;
  floorH?: number;
  inset?: number;
  trim?: string;
  door?: string;
  glass?: string;
  awning?: [string, string];
  sign?: string;
  signBg?: string;
  prop?: string;
  propSize?: number;
  chimney?: boolean;
  porch?: boolean;
  balcony?: boolean;
  columns?: boolean;
  clock?: boolean;
  flag?: string;
  arch?: boolean;
  garage?: boolean;
  doors?: number;
  brick?: boolean;
  timber?: boolean;
  wing?: boolean;
  tank?: boolean;
  bell?: boolean;
  lawn?: boolean;
  pave?: boolean;
  tall?: number;
}

/** Draws the item at both facings: keys `${key}.0` and `${key}.1`. */
export function drawBuildingSet(bank: SpriteBank, key: string, size: [number, number], p: BuildingParams): void {
  drawBuilding(bank, `${key}.0`, size[0], size[1], 'L', p);
  if (size[0] === size[1]) drawBuilding(bank, `${key}.1`, size[0], size[1], 'R', p);
  else drawBuilding(bank, `${key}.1`, size[1], size[0], 'R', p);
}

function heightOf(p: BuildingParams, w: number, d: number): number {
  const floors = p.floors ?? 1;
  const fh = p.floorH ?? 22;
  return floors * fh + (p.tall ?? 0) + Math.max(w, d) * 2;
}

export function drawBuilding(bank: SpriteBank, key: string, w: number, d: number, front: Face, p: BuildingParams): void {
  const H = heightOf(p, w, d);
  const top = H + 48 + (p.propSize ?? 26) + (p.clock || p.bell ? 30 : 0) + (p.flag ? 16 : 0);
  const f = frameFor(w, d, top, 18, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    switch (p.style) {
      case 'silo':
        return silo(iso, w, d, p);
      case 'barn':
        return barn(iso, w, d, front, p);
      default:
        return generic(iso, w, d, front, p, H);
    }
  });
}

function groundPad(iso: Iso, w: number, d: number, p: BuildingParams, front: Face): void {
  if (p.pave) {
    iso.tile(0.08, 0.08, w - 0.16, d - 0.16, PAL.sidewalk, 'rgba(120,110,95,0.35)');
  } else if (p.lawn !== false) {
    iso.tile(0.1, 0.1, w - 0.2, d - 0.2, shade(PAL.lawn, 0.06), null);
  }
  // footpath from the door to the front edge
  const inset = p.inset ?? 0.4;
  if (front === 'L') iso.tile(w / 2 - 0.3, d - inset - 0.05, 0.6, inset + 0.02, PAL.sidewalk, null);
  else iso.tile(w - inset - 0.05, d / 2 - 0.3, inset + 0.02, 0.6, PAL.sidewalk, null);
}

function generic(iso: Iso, w: number, d: number, front: Face, p: BuildingParams, H: number): void {
  const c = iso.ctx;
  const inset = p.inset ?? 0.4;
  const floors = p.floors ?? 1;
  const fh = p.floorH ?? 22;
  const body: Box = { x: inset, y: inset, z: 0, w: w - inset * 2, d: d - inset * 2, h: floors * fh + (p.tall ?? 0) };
  iso.shadow(body, H);
  groundPad(iso, w, d, p, front);

  // optional side wing (lower box at the back)
  if (p.wing) {
    const wing: Box = front === 'L'
      ? { x: body.x + body.w * 0.55, y: body.y - 0.0, z: 0, w: body.w * 0.45, d: body.d * 0.45, h: body.h + fh * 0.6 }
      : { x: body.x, y: body.y + body.d * 0.55, z: 0, w: body.w * 0.45, d: body.d * 0.45, h: body.h + fh * 0.6 };
    iso.box(wing, shade(p.wall, -0.04));
    iso.hip(wing, 10, p.roof, 0.08);
  }

  iso.box(body, p.wall);
  const wallTex = (face: Face) =>
    iso.onFace(body, face, (t, fw, fhh) => {
      if (p.brick) {
        t.fillStyle = 'rgba(90,30,20,0.18)';
        for (let v = 3; v < fhh; v += 4) {
          const off = (Math.floor(v / 4) % 2) * 4;
          for (let u = off; u < fw; u += 8) t.fillRect(u, v, 6, 0.8);
        }
      }
      if (p.timber) {
        t.fillStyle = shade(p.trim ?? PAL.woodDark, -0.1);
        for (let u = 0; u <= fw; u += fw / 4) t.fillRect(u - 1, 0, 2, fhh);
        for (let fl = 1; fl < floors; fl++) t.fillRect(0, fhh - fl * fh - 1, fw, 2);
      }
    });
  wallTex('L');
  wallTex('R');

  const trim = p.trim ?? '#ffffff';
  const glass = p.glass ?? PAL.glass;
  // facade details
  const facade = (face: Face, isFront: boolean) =>
    iso.onFace(body, face, (t, fw, fhh) => {
      const ground = fhh - (p.tall ?? 0) * 0;
      // floor trims
      t.fillStyle = shade(trim, -0.05);
      for (let fl = 1; fl < floors; fl++) t.fillRect(0, fhh - fl * fh - 1.5, fw, 2.5);
      t.fillRect(0, 0, fw, 2.5);
      // windows on upper floors
      const winW = p.style === 'civic' ? 7 : 8;
      const winH = Math.min(13, fh * 0.55);
      const slots = Math.max(1, Math.floor((fw - 8) / 16));
      for (let fl = floors - 1; fl >= 1; fl--) {
        const vy = fhh - fl * fh - fh + (fh - winH) / 2 + 1;
        for (let i = 0; i < slots; i++) {
          const ux = (fw / slots) * (i + 0.5) - winW / 2;
          windowPane(t, ux, vy, winW, winH, trim, glass, p.arch);
          if (p.balcony && face === 'L') {
            rect(t, ux - 3, vy + winH + 1, winW + 6, 2.5, shade(trim, -0.15));
            t.fillStyle = shade(trim, -0.25);
            for (let k = 0; k <= winW + 6; k += 3) t.fillRect(ux - 3 + k, vy + winH - 4, 0.8, 5);
          }
        }
      }
      // ground floor
      const gy = ground - fh;
      if (isFront) {
        const doors = p.doors ?? 1;
        if (p.garage) {
          const gw = Math.min(26, fw * 0.4);
          for (let i = 0; i < 2; i++) {
            const gx = fw * (i === 0 ? 0.08 : 0.92) - (i === 0 ? 0 : gw);
            rect(t, gx, gy + 4, gw, fh - 4, '#e5e5e5', '#9aa0a6');
            t.fillStyle = 'rgba(0,0,0,0.12)';
            for (let v = gy + 8; v < ground - 1; v += 4) t.fillRect(gx + 1, v, gw - 2, 1);
          }
          door(t, fw / 2 - 4, gy + fh * 0.32, 8, fh * 0.68, p.door ?? PAL.woodDark, false);
        } else if (p.style === 'shop') {
          // big display windows either side of the door
          const dw = 9;
          const dx = fw * 0.5 - dw / 2;
          const winTop = gy + fh * 0.3;
          rect(t, 3, winTop, dx - 6, fh * 0.6, trim);
          const g = t.createLinearGradient(3, winTop, dx - 3, ground);
          g.addColorStop(0, shade(glass, 0.3));
          g.addColorStop(1, shade(glass, -0.2));
          t.fillStyle = g;
          t.fillRect(4.5, winTop + 1.5, dx - 9, fh * 0.6 - 3);
          rect(t, dx + dw + 3, winTop, fw - dx - dw - 6, fh * 0.6, trim);
          t.fillStyle = g;
          t.fillRect(dx + dw + 4.5, winTop + 1.5, fw - dx - dw - 9, fh * 0.6 - 3);
          t.fillStyle = 'rgba(255,255,255,0.45)';
          t.fillRect(6, winTop + 3, 3, fh * 0.35);
          t.fillRect(dx + dw + 6, winTop + 3, 3, fh * 0.35);
          door(t, dx, gy + fh * 0.28, dw, fh * 0.72, p.door ?? '#5b3a1a', false);
          t.fillStyle = 'rgba(143,211,244,0.8)';
          t.fillRect(dx + 2, gy + fh * 0.36, dw - 4, fh * 0.28);
        } else {
          for (let i = 0; i < doors; i++) {
            const dw = 8;
            const ux = doors === 1 ? fw / 2 - dw / 2 : fw * (0.3 + i * 0.4) - dw / 2;
            door(t, ux, gy + fh * 0.3, dw, fh * 0.7, p.door ?? PAL.woodDark, p.arch !== false);
            // windows beside each door
            if (fw > 40) {
              const wx = doors === 1 ? [ux - 16, ux + dw + 8] : [ux + (i === 0 ? -14 : dw + 6)];
              for (const x of wx) if (x > 2 && x + 8 < fw - 2) windowPane(t, x, gy + fh * 0.32, 8, Math.min(11, fh * 0.45), trim, glass, p.arch);
            }
          }
          if (p.style === 'house') {
            // flower box under the first window
            t.fillStyle = '#7a4e2d';
            t.fillRect(fw / 2 - 22, gy + fh * 0.32 + 12, 12, 3);
            t.fillStyle = '#ff6fa3';
            t.fillRect(fw / 2 - 21, gy + fh * 0.32 + 10, 3, 2);
            t.fillStyle = '#ffd23f';
            t.fillRect(fw / 2 - 16, gy + fh * 0.32 + 10, 3, 2);
          }
        }
      } else {
        const n = Math.max(1, Math.floor((fw - 8) / 18));
        for (let i = 0; i < n; i++) {
          const ux = (fw / n) * (i + 0.5) - 4;
          windowPane(t, ux, gy + fh * 0.3, 8, Math.min(12, fh * 0.5), trim, glass, p.arch);
        }
      }
      // columns for civic porticos
      if (isFront && p.columns) {
        const cols = Math.max(4, Math.floor(fw / 14));
        for (let i = 0; i < cols; i++) {
          const ux = 4 + ((fw - 8) / (cols - 1)) * i - 2;
          const g = t.createLinearGradient(ux, 0, ux + 4, 0);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, '#cfc8b8');
          t.fillStyle = g;
          t.fillRect(ux, 4, 4, ground - 4);
          t.fillStyle = '#e6dfcf';
          t.fillRect(ux - 1, 3, 6, 2);
          t.fillRect(ux - 1, ground - 2, 6, 2);
        }
      }
      if (isFront && p.clock) {
        const cx = fw / 2;
        const cy = Math.max(9, fhh - floors * fh + 9);
        t.beginPath();
        t.arc(cx, cy, 6.5, 0, Math.PI * 2);
        t.fillStyle = '#ffffff';
        t.fill();
        t.strokeStyle = '#3b2a1e';
        t.lineWidth = 1.2;
        t.stroke();
        t.beginPath();
        t.moveTo(cx, cy);
        t.lineTo(cx, cy - 4);
        t.moveTo(cx, cy);
        t.lineTo(cx + 3, cy + 1);
        t.stroke();
      }
    });
  facade(front, true);
  facade(front === 'L' ? 'R' : 'L', false);

  // awning + sign on the front
  if (p.awning) {
    iso.onFace(body, front, (t, fw, fhh) => {
      const gy = fhh - fh;
      awning(t, 0, gy + 1, fw - 2, 7, p.awning!, Math.max(4, Math.round(fw / 9)));
    });
  }
  if (p.porch) porch(iso, body, front, fh, trim);

  roof(iso, body, front, p);

  // sign board above the ground floor (front face), or on the roof edge
  if (p.sign) {
    iso.onFace(body, front, (t, fw, fhh) => {
      const sy = floors > 1 ? fhh - fh - 7 : Math.max(8, fhh - fh - 3);
      const sw = Math.min(fw * 0.55, 34);
      signBoard(t, fw / 2, Math.max(7, sy), sw, 13, p.signBg ?? '#fff4e0', p.sign!);
    });
  }
  if (p.chimney) {
    const cx = body.x + body.w * 0.72;
    const cy = body.y + body.d * 0.3;
    iso.box({ x: cx, y: cy, z: body.h, w: 0.35, d: 0.35, h: 20 }, PAL.brick);
    iso.box({ x: cx - 0.05, y: cy - 0.05, z: body.h + 20, w: 0.45, d: 0.45, h: 3 }, shade(PAL.brick, -0.1));
  }
  if (p.tank) {
    const [sx, sy] = iso.p(body.x + body.w * 0.3, body.y + body.d * 0.3, body.h + 4);
    c.fillStyle = PAL.woodDark;
    c.fillRect(sx - 8, sy - 10, 2, 10);
    c.fillRect(sx + 6, sy - 10, 2, 10);
    iso.cylinder(body.x + body.w * 0.3, body.y + body.d * 0.3, body.h + 14, 0.32, 14, '#a5703f');
    iso.cone(body.x + body.w * 0.3, body.y + body.d * 0.3, body.h + 28, 0.36, 9, '#5b6b7a');
  }
  // big caricature prop on top
  if (p.prop) {
    const rise = roofRise(p, body);
    const [sx, sy] = iso.p(body.x + body.w / 2, body.y + body.d / 2, body.h + rise * (p.roofType === 'flat' || !p.roofType ? 1 : 0.85));
    const s = p.propSize ?? 26;
    if (p.roofType === 'flat' || !p.roofType) {
      // little post/stand
      c.fillStyle = '#7a7f86';
      c.fillRect(sx - 1.5, sy - s * 0.35, 3, s * 0.35);
    }
    drawProp(c, p.prop, sx, sy - s * 0.65, s);
  }
  if (p.flag) {
    const [sx, sy] = iso.p(body.x + body.w / 2, body.y + body.d / 2, body.h + roofRise(p, body) + (p.clock || p.bell ? 30 : 0));
    c.fillStyle = '#6b6e73';
    c.fillRect(sx - 0.75, sy - 22, 1.5, 22);
    c.fillStyle = p.flag;
    c.beginPath();
    c.moveTo(sx + 0.75, sy - 22);
    c.quadraticCurveTo(sx + 7, sy - 24, sx + 13, sy - 20);
    c.lineTo(sx + 13, sy - 14);
    c.quadraticCurveTo(sx + 7, sy - 18, sx + 0.75, sy - 15);
    c.closePath();
    c.fill();
  }
}

function roofRise(p: BuildingParams, b: Box): number {
  switch (p.roofType) {
    case 'gable':
    case 'gableSide':
      return 10 + Math.min(b.w, b.d) * 7;
    case 'hip':
      return 8 + Math.min(b.w, b.d) * 5.5;
    case 'gambrel':
      return 14 + Math.min(b.w, b.d) * 7;
    case 'dome':
      return 14 + Math.min(b.w, b.d) * 4;
    default:
      return 4;
  }
}

function roof(iso: Iso, b: Box, front: Face, p: BuildingParams): void {
  const rise = roofRise(p, b);
  switch (p.roofType) {
    case 'gable': {
      // ridge parallel to the front so the eave side faces the street
      const axis = front === 'L' ? 'x' : 'y';
      iso.gable(b, rise, axis, p.roof, 0.12, iso.outline, p.wall);
      tiles(iso, b, rise, axis, p.roof);
      atticWindow(iso, b, rise, axis, p);
      return;
    }
    case 'gableSide': {
      const axis = front === 'L' ? 'y' : 'x';
      iso.gable(b, rise, axis, p.roof, 0.12, iso.outline, p.wall);
      atticWindow(iso, b, rise, axis, p);
      return;
    }
    case 'hip':
      iso.hip(b, rise, p.roof);
      return;
    case 'dome': {
      iso.flatRoof(b, shade(p.wall, -0.05));
      const r = Math.min(b.w, b.d) * 0.28;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.d / 2;
      iso.cylinder(cx, cy, b.h + 4, r, 12, p.wall);
      iso.dome(cx, cy, b.h + 16, r, rise, p.roof);
      if (p.clock || p.bell) {
        const [sx, sy] = iso.p(cx, cy, b.h + 16 + rise);
        iso.ctx.fillStyle = '#f2c94c';
        iso.ctx.beginPath();
        iso.ctx.arc(sx, sy - 3, 3, 0, Math.PI * 2);
        iso.ctx.fill();
      }
      return;
    }
    case 'gambrel':
      iso.gable(b, rise, front === 'L' ? 'y' : 'x', p.roof, 0.15);
      return;
    default:
      iso.flatRoof(b, p.roof);
      if (p.bell) belfry(iso, b, p);
  }
}

function atticWindow(iso: Iso, b: Box, rise: number, axis: 'x' | 'y', p: BuildingParams): void {
  const c = iso.ctx;
  const [sx, sy] = axis === 'x' ? iso.p(b.x + b.w, b.y + b.d / 2, b.z + b.h + rise * 0.38) : iso.p(b.x + b.w / 2, b.y + b.d, b.z + b.h + rise * 0.38);
  const r = Math.min(4.5, rise * 0.16);
  c.beginPath();
  c.arc(sx, sy, r + 1.2, 0, Math.PI * 2);
  c.fillStyle = p.trim ?? '#ffffff';
  c.fill();
  c.beginPath();
  c.arc(sx, sy, r, 0, Math.PI * 2);
  c.fillStyle = shade(p.glass ?? PAL.glass, -0.1);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillRect(sx - r * 0.5, sy - r * 0.5, r * 0.5, r * 0.5);
}

function tiles(iso: Iso, b: Box, rise: number, axis: 'x' | 'y', color: string): void {
  // a few shingle lines on the lit slope
  const c = iso.ctx;
  c.strokeStyle = shade(color, -0.18);
  c.lineWidth = 0.8;
  const n = 4;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (axis === 'x') {
      const y = b.y + b.d - (b.d / 2) * t;
      iso.path([[b.x - 0.1, y + 0.12 * (1 - t), b.z + b.h + rise * t], [b.x + b.w + 0.1, y + 0.12 * (1 - t), b.z + b.h + rise * t]]);
    } else {
      const x = b.x + b.w - (b.w / 2) * t;
      iso.path([[x + 0.12 * (1 - t), b.y - 0.1, b.z + b.h + rise * t], [x + 0.12 * (1 - t), b.y + b.d + 0.1, b.z + b.h + rise * t]]);
    }
    c.stroke();
  }
}

function belfry(iso: Iso, b: Box, p: BuildingParams): void {
  const s = Math.min(b.w, b.d) * 0.3;
  const x = b.x + b.w / 2 - s / 2;
  const y = b.y + b.d / 2 - s / 2;
  const tower: Box = { x, y, z: b.h + 4, w: s, d: s, h: 22 };
  iso.box(tower, p.wall);
  iso.onFace(tower, 'L', (t, fw) => {
    t.fillStyle = '#3b2a1e';
    t.beginPath();
    t.moveTo(fw / 2 - 4, 18);
    t.lineTo(fw / 2 - 4, 8);
    t.arc(fw / 2, 8, 4, Math.PI, 0);
    t.lineTo(fw / 2 + 4, 18);
    t.fill();
    drawProp(t, 'bell', fw / 2, 11, 8);
  });
  iso.hip(tower, 12, p.roof, 0.1);
}

function porch(iso: Iso, b: Box, front: Face, fh: number, trim: string): void {
  const depth = 0.5;
  const pb: Box = front === 'L'
    ? { x: b.x + b.w * 0.25, y: b.y + b.d, z: fh * 0.82, w: b.w * 0.5, d: depth, h: 3 }
    : { x: b.x + b.w, y: b.y + b.d * 0.25, z: fh * 0.82, w: depth, d: b.d * 0.5, h: 3 };
  const c = iso.ctx;
  const posts: [number, number][] = front === 'L'
    ? [[pb.x + 0.08, pb.y + depth - 0.08], [pb.x + pb.w - 0.08, pb.y + depth - 0.08]]
    : [[pb.x + depth - 0.08, pb.y + 0.08], [pb.x + depth - 0.08, pb.y + pb.d - 0.08]];
  for (const [x, y] of posts) {
    const [sx, sy] = iso.p(x, y, 0);
    c.fillStyle = trim;
    c.fillRect(sx - 1.2, sy - fh * 0.82, 2.4, fh * 0.82);
  }
  iso.box(pb, { top: shade(trim, -0.05), left: trim, right: shade(trim, -0.2) });
}

function barn(iso: Iso, w: number, d: number, front: Face, p: BuildingParams): void {
  const inset = p.inset ?? 0.35;
  const fh = p.floorH ?? 26;
  const body: Box = { x: inset, y: inset, z: 0, w: w - inset * 2, d: d - inset * 2, h: fh };
  iso.shadow(body, fh + 30);
  iso.tile(0.1, 0.1, w - 0.2, d - 0.2, shade(PAL.lawn, 0.02), null);
  iso.box(body, p.wall);
  iso.onFace(body, front, (t, fw, fhh) => {
    // planks
    t.fillStyle = 'rgba(80,20,10,0.18)';
    for (let u = 4; u < fw; u += 5) t.fillRect(u, 0, 0.8, fhh);
    // big doors with X bracing
    const dw = Math.min(30, fw * 0.45);
    const dx = fw / 2 - dw / 2;
    rect(t, dx, fhh * 0.25, dw, fhh * 0.75, shade(p.wall, -0.1), '#ffffff', 2);
    t.strokeStyle = '#ffffff';
    t.lineWidth = 1.6;
    t.beginPath();
    t.moveTo(dx + 1, fhh * 0.25 + 1);
    t.lineTo(dx + dw / 2, fhh - 1);
    t.moveTo(dx + dw / 2, fhh * 0.25 + 1);
    t.lineTo(dx + 1, fhh - 1);
    t.moveTo(dx + dw / 2, fhh * 0.25 + 1);
    t.lineTo(dx + dw - 1, fhh - 1);
    t.moveTo(dx + dw - 1, fhh * 0.25 + 1);
    t.lineTo(dx + dw / 2, fhh - 1);
    t.moveTo(dx + dw / 2, fhh * 0.25);
    t.lineTo(dx + dw / 2, fhh);
    t.stroke();
    t.fillStyle = '#ffffff';
    t.fillRect(0, 0, fw, 2);
  });
  iso.onFace(body, front === 'L' ? 'R' : 'L', (t, fw, fhh) => {
    t.fillStyle = 'rgba(80,20,10,0.18)';
    for (let u = 4; u < fw; u += 5) t.fillRect(u, 0, 0.8, fhh);
    windowPane(t, fw / 2 - 5, fhh * 0.3, 10, 9, '#ffffff', PAL.glass);
  });
  const rise = 16 + Math.min(body.w, body.d) * 7;
  const axis = front === 'L' ? 'y' : 'x';
  iso.gable(body, rise, axis, p.roof, 0.15, iso.outline, p.wall);
  // hay loft door on the gable end
  const [hx, hy] = axis === 'x' ? iso.p(body.x + body.w, body.y + body.d / 2, body.h + rise * 0.35) : iso.p(body.x + body.w / 2, body.y + body.d, body.h + rise * 0.35);
  iso.ctx.fillStyle = '#ffffff';
  iso.ctx.fillRect(hx - 5, hy - 6, 10, 9);
  iso.ctx.fillStyle = shade(p.wall, -0.3);
  iso.ctx.fillRect(hx - 3.5, hy - 4.5, 7, 6);
  if (p.prop) {
    const [sx, sy] = iso.p(body.x + body.w / 2, body.y + body.d / 2, body.h + rise);
    drawProp(iso.ctx, p.prop, sx, sy - (p.propSize ?? 20) * 0.6, p.propSize ?? 20);
  }
}

function silo(iso: Iso, w: number, d: number, p: BuildingParams): void {
  const r = Math.min(w, d) * 0.36;
  const h = (p.floorH ?? 46) + (p.tall ?? 0);
  iso.shadow({ x: w / 2 - r, y: d / 2 - r, w: r * 2, d: r * 2 }, h);
  iso.tile(0.1, 0.1, w - 0.2, d - 0.2, shade(PAL.lawn, 0.02), null);
  iso.cylinder(w / 2, d / 2, 0, r, h, p.wall);
  const c = iso.ctx;
  const [sx, sy] = iso.p(w / 2, d / 2, 0);
  const rx = r * 32 * 1.414;
  c.strokeStyle = 'rgba(0,0,0,0.15)';
  c.lineWidth = 1;
  for (let z = 10; z < h; z += 9) {
    c.beginPath();
    c.ellipse(sx, sy - z, rx, rx / 2, 0, 0, Math.PI);
    c.stroke();
  }
  iso.dome(w / 2, d / 2, h, r, 14, p.roof);
  if (p.prop) drawProp(c, p.prop, sx, sy - h - 22, p.propSize ?? 16);
}
