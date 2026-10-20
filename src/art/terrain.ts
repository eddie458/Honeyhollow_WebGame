// Ground art: lawn lots, wild land with trees, the sea, roads, sidewalks and
// generic construction stages. Farm plots and their crops are in crops.ts.
import { hash2 } from '../sim/rng';
import { PAL, shade } from './color';
import { HH, HW, Iso, TH, TW } from './iso';
import type { SpriteBank } from './atlas';

const LOT = 12;

/** Logical canvas setup for a w x d footprint with `top` px of headroom. */
export function frameFor(w: number, d: number, top: number, padX = 6, padBottom = 6) {
  const W = (w + d) * HW + padX * 2;
  const H = (w + d) * HH + top + padBottom;
  return { W, H, ax: d * HW + padX, ay: top };
}

export function drawLawnLot(bank: SpriteBank, key: string, variant: number): void {
  const f = frameFor(LOT, LOT, 2, 0, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0, 0, LOT, LOT, PAL.lawn, null);
    iso.onTop(0, 0, 0, (t) => {
      // Very soft checker so the tile grid is readable while placing.
      for (let i = 0; i < LOT; i++) {
        for (let j = 0; j < LOT; j++) {
          if ((i + j) % 2 === 0) {
            t.fillStyle = 'rgba(255,255,255,0.035)';
            t.fillRect(i * 32, j * 32, 32, 32);
          }
        }
      }
      // grass tufts and tiny flowers
      for (let n = 0; n < 260; n++) {
        const u = hash2(n, variant, 1) * 384;
        const v = hash2(n, variant, 2) * 384;
        const r = hash2(n, variant, 3);
        t.fillStyle = r < 0.5 ? 'rgba(60,120,30,0.35)' : 'rgba(170,220,110,0.35)';
        t.fillRect(u, v, 3 + r * 4, 1.5);
      }
    });
    // upright grass blades / flowers (unskewed)
    for (let n = 0; n < 40; n++) {
      const x = hash2(n, variant, 5) * LOT;
      const y = hash2(n, variant, 6) * LOT;
      const [sx, sy] = iso.p(x, y);
      const r = hash2(n, variant, 7);
      if (r < 0.12) {
        c.fillStyle = r < 0.06 ? '#fff6c8' : '#ffd1e0';
        c.beginPath();
        c.arc(sx, sy - 1, 1.3, 0, Math.PI * 2);
        c.fill();
      } else {
        c.strokeStyle = 'rgba(70,130,35,0.6)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(sx - 1.5, sy);
        c.lineTo(sx - 2.5, sy - 3);
        c.moveTo(sx, sy);
        c.lineTo(sx, sy - 4);
        c.moveTo(sx + 1.5, sy);
        c.lineTo(sx + 2.5, sy - 3);
        c.stroke();
      }
    }
  });
}

/** A round deciduous tree or a pine, drawn as a billboard at (sx, sy). */
export function drawTree(c: CanvasRenderingContext2D, sx: number, sy: number, size: number, kind: 'round' | 'pine' | 'bush', tint = 0): void {
  const green = shade('#4f9d35', tint);
  if (kind === 'bush') {
    c.fillStyle = 'rgba(20,40,10,0.25)';
    c.beginPath();
    c.ellipse(sx + 2, sy, size * 0.9, size * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    blobCluster(c, sx, sy - size * 0.45, size * 0.75, green);
    return;
  }
  c.fillStyle = 'rgba(20,40,10,0.25)';
  c.beginPath();
  c.ellipse(sx + size * 0.35, sy, size * 0.8, size * 0.32, 0, 0, Math.PI * 2);
  c.fill();
  // trunk
  c.fillStyle = '#7a4e2d';
  c.fillRect(sx - size * 0.09, sy - size * 0.9, size * 0.18, size * 0.9);
  c.fillStyle = '#5e3a20';
  c.fillRect(sx + size * 0.02, sy - size * 0.9, size * 0.07, size * 0.9);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const w = size * (0.85 - i * 0.2);
      const by = sy - size * (0.55 + i * 0.45);
      c.beginPath();
      c.moveTo(sx - w, by);
      c.lineTo(sx, by - size * 0.75);
      c.lineTo(sx + w, by);
      c.closePath();
      const g = c.createLinearGradient(sx - w, 0, sx + w, 0);
      g.addColorStop(0, shade('#3f8a3a', 0.15 + tint));
      g.addColorStop(1, shade('#2f6d2e', tint));
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = 'rgba(30,60,20,0.5)';
      c.lineWidth = 1;
      c.stroke();
    }
    return;
  }
  blobCluster(c, sx, sy - size * 1.35, size, green);
}

function blobCluster(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  const parts: [number, number, number][] = [
    [-0.45, 0.15, 0.55],
    [0.45, 0.15, 0.55],
    [0, -0.25, 0.62],
    [-0.15, 0.3, 0.5],
    [0.2, 0.32, 0.5],
  ];
  c.strokeStyle = 'rgba(30,60,20,0.55)';
  c.lineWidth = 1;
  for (const [dx, dy, rr] of parts) {
    c.beginPath();
    c.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
    c.fillStyle = shade(color, -0.12);
    c.fill();
    c.stroke();
  }
  for (const [dx, dy, rr] of parts) {
    const g = c.createRadialGradient(cx + dx * r - rr * r * 0.3, cy + dy * r - rr * r * 0.4, rr * r * 0.1, cx + dx * r, cy + dy * r, rr * r);
    g.addColorStop(0, shade(color, 0.3));
    g.addColorStop(1, shade(color, -0.05));
    c.beginPath();
    c.arc(cx + dx * r, cy + dy * r, rr * r * 0.92, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
  }
}

export function drawWildLot(bank: SpriteBank, key: string, variant: number): void {
  const top = 70;
  const f = frameFor(LOT, LOT, top, 0, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0, 0, LOT, LOT, PAL.wild, null);
    iso.onTop(0, 0, 0, (t) => {
      for (let n = 0; n < 220; n++) {
        const u = hash2(n, variant, 11) * 384;
        const v = hash2(n, variant, 12) * 384;
        t.fillStyle = hash2(n, variant, 13) < 0.5 ? 'rgba(50,100,25,0.35)' : 'rgba(150,200,90,0.25)';
        t.fillRect(u, v, 5, 2);
      }
    });
    const things: { x: number; y: number; kind: 'round' | 'pine' | 'bush' | 'rock'; size: number; tint: number }[] = [];
    for (let n = 0; n < 16; n++) {
      const x = 0.8 + hash2(n, variant, 21) * (LOT - 1.6);
      const y = 0.8 + hash2(n, variant, 22) * (LOT - 1.6);
      const r = hash2(n, variant, 23);
      const kind = r < 0.45 ? 'round' : r < 0.75 ? 'pine' : r < 0.92 ? 'bush' : 'rock';
      things.push({ x, y, kind, size: 13 + hash2(n, variant, 24) * 8, tint: (hash2(n, variant, 25) - 0.5) * 0.2 });
    }
    things.sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const t of things) {
      const [sx, sy] = iso.p(t.x, t.y);
      if (t.kind === 'rock') {
        c.fillStyle = '#9aa0a6';
        c.beginPath();
        c.ellipse(sx, sy - 3, 6, 4, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#c3c8cc';
        c.beginPath();
        c.ellipse(sx - 1.5, sy - 4.5, 3, 2, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        drawTree(c, sx, sy, t.size, t.kind, t.tint);
      }
    }
  });
}

/** Sea lot; if `shore` the top edge is a sandy beach. */
export function drawSeaLot(bank: SpriteBank, key: string, shore: boolean, variant: number): void {
  const f = frameFor(LOT, LOT, 2, 0, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0, 0, LOT, LOT, PAL.water, null);
    iso.onTop(0, 0, 0, (t) => {
      const g = t.createLinearGradient(0, 0, 0, 384);
      g.addColorStop(0, shore ? '#5fc0e6' : PAL.water);
      g.addColorStop(1, PAL.waterDeep);
      t.fillStyle = g;
      t.fillRect(0, 0, 384, 384);
      if (shore) {
        t.fillStyle = PAL.sand;
        t.fillRect(0, 0, 384, 26);
        t.fillStyle = shade(PAL.sand, -0.08);
        for (let n = 0; n < 60; n++) t.fillRect(hash2(n, variant, 31) * 384, hash2(n, variant, 32) * 24, 3, 1.5);
        // foam line
        t.strokeStyle = 'rgba(255,255,255,0.85)';
        t.lineWidth = 3;
        t.beginPath();
        for (let u = 0; u <= 384; u += 8) t.lineTo(u, 27 + Math.sin(u / 18 + variant) * 2);
        t.stroke();
      }
      t.strokeStyle = 'rgba(255,255,255,0.35)';
      t.lineWidth = 1.5;
      for (let n = 0; n < 26; n++) {
        const u = hash2(n, variant, 33) * 360;
        const v = (shore ? 40 : 0) + hash2(n, variant, 34) * (shore ? 330 : 370);
        t.beginPath();
        t.moveTo(u, v);
        t.quadraticCurveTo(u + 6, v - 3, u + 12, v);
        t.stroke();
      }
    });
  });
}

// ------------------------------------------------------------------ roads --

/** Road piece (3x3 tiles) for a connection mask: 1=N(-y) 2=E(+x) 4=S(+y) 8=W(-x). */
export function drawRoad(bank: SpriteBank, key: string, mask: number): void {
  const f = frameFor(3, 3, 2, 1, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.onTop(0, 0, 0, (t) => {
      const S = 96;
      const kerb = 9;
      t.fillStyle = PAL.asphalt;
      t.fillRect(0, 0, S, S);
      // subtle asphalt grain
      for (let n = 0; n < 50; n++) {
        t.fillStyle = n % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        t.fillRect(hash2(n, mask, 41) * S, hash2(n, mask, 42) * S, 2, 2);
      }
      const N = (mask & 1) !== 0, E = (mask & 2) !== 0, Sth = (mask & 4) !== 0, W = (mask & 8) !== 0;
      const pave = (x: number, y: number, w: number, h: number) => {
        t.fillStyle = PAL.sidewalk;
        t.fillRect(x, y, w, h);
        t.fillStyle = 'rgba(120,110,95,0.25)';
        for (let i = 4; i < Math.max(w, h); i += 8) {
          if (w > h) t.fillRect(x + i, y, 0.8, h);
          else t.fillRect(x, y + i, w, 0.8);
        }
      };
      const curb = (x: number, y: number, w: number, h: number) => {
        t.fillStyle = PAL.curbDark;
        t.fillRect(x, y, w, h);
      };
      if (!N) { pave(0, 0, S, kerb); curb(0, kerb, S, 1.5); }
      if (!Sth) { pave(0, S - kerb, S, kerb); curb(0, S - kerb - 1.5, S, 1.5); }
      if (!W) { pave(0, 0, kerb, S); curb(kerb, N ? 0 : kerb, 1.5, S - (N ? 0 : kerb) - (Sth ? 0 : kerb)); }
      if (!E) { pave(S - kerb, 0, kerb, S); curb(S - kerb - 1.5, N ? 0 : kerb, 1.5, S - (N ? 0 : kerb) - (Sth ? 0 : kerb)); }
      // corner sidewalk squares where two connected sides meet
      if (N && E) pave(S - kerb, 0, kerb, kerb);
      if (N && W) pave(0, 0, kerb, kerb);
      if (Sth && E) pave(S - kerb, S - kerb, kerb, kerb);
      if (Sth && W) pave(0, S - kerb, kerb, kerb);
      // lane markings
      const count = [N, E, Sth, W].filter(Boolean).length;
      t.fillStyle = PAL.lane;
      const dash = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.floor(len / 12);
        for (let i = 0; i < n; i++) {
          const a = (i * 12 + 3) / len;
          const b = Math.min(1, (i * 12 + 9) / len);
          const ax = x0 + (x1 - x0) * a, ay = y0 + (y1 - y0) * a;
          const bx = x0 + (x1 - x0) * b, by = y0 + (y1 - y0) * b;
          t.fillRect(Math.min(ax, bx) - (x0 === x1 ? 1 : 0), Math.min(ay, by) - (y0 === y1 ? 1 : 0), Math.abs(bx - ax) || 2, Math.abs(by - ay) || 2);
        }
      };
      const mid = S / 2;
      if (count <= 2 && ((N && Sth) || (E && W))) {
        if (N && Sth) dash(mid, 0, mid, S);
        else dash(0, mid, S, mid);
      } else if (count >= 3) {
        // crosswalk stripes at each connected mouth
        t.fillStyle = 'rgba(244,239,224,0.9)';
        const zebra = (horizontal: boolean, at: number) => {
          for (let i = kerb + 4; i < S - kerb - 4; i += 7) {
            if (horizontal) t.fillRect(i, at, 4, 8);
            else t.fillRect(at, i, 8, 4);
          }
        };
        if (N) zebra(true, 2);
        if (Sth) zebra(true, S - 10);
        if (W) zebra(false, 2);
        if (E) zebra(false, S - 10);
      } else {
        if (N) dash(mid, 0, mid, mid);
        if (Sth) dash(mid, mid, mid, S);
        if (W) dash(0, mid, mid, mid);
        if (E) dash(mid, mid, S, mid);
      }
    });
  });
}

export function drawSidewalk(bank: SpriteBank, key: string): void {
  const f = frameFor(1, 1, 2, 1, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.onTop(0, 0, 0, (t) => {
      t.fillStyle = PAL.sidewalk;
      t.fillRect(0, 0, 32, 32);
      t.fillStyle = 'rgba(120,110,95,0.3)';
      t.fillRect(0, 15.5, 32, 1);
      t.fillRect(15.5, 0, 1, 32);
      t.fillStyle = 'rgba(255,255,255,0.35)';
      t.fillRect(1, 1, 13, 2);
      t.fillRect(17, 17, 13, 2);
      t.strokeStyle = PAL.curbDark;
      t.lineWidth = 1;
      t.strokeRect(0.5, 0.5, 31, 31);
    });
  });
}

// --------------------------------------------------------- construction --

export function drawConstruction(bank: SpriteBank, key: string, w: number, d: number, stage: number): void {
  const top = 30 + stage * 22 + (w + d) * 3;
  const f = frameFor(w, d, top, 4, 6);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    // dirt pad
    iso.box({ x: 0.1, y: 0.1, z: 0, w: w - 0.2, d: d - 0.2, h: 2 }, { top: '#b08a5a', left: '#94714a', right: '#7b5c3b' }, 'rgba(60,40,20,0.4)');
    iso.onTop(0.1, 0.1, 2, (t) => {
      t.fillStyle = 'rgba(80,55,30,0.25)';
      for (let n = 0; n < 30; n++) t.fillRect(hash2(n, w * 10 + d, 51) * (w - 0.2) * 32, hash2(n, w * 10 + d, 52) * (d - 0.2) * 32, 4, 2);
    });
    if (stage >= 2) {
      // concrete foundation
      iso.box({ x: 0.35, y: 0.35, z: 2, w: w - 0.7, d: d - 0.7, h: 4 }, '#c9c6bf');
    }
    if (stage >= 3) {
      // wall frame up to mid height
      const h = 12 + (w + d) * 2;
      iso.box({ x: 0.45, y: 0.45, z: 6, w: w - 0.9, d: d - 0.9, h }, { top: '#e7d8b8', left: '#efe2c4', right: '#cdbb98' });
      iso.onFace({ x: 0.45, y: 0.45, z: 6, w: w - 0.9, d: d - 0.9, h }, 'L', (t, fw, fh) => {
        t.fillStyle = 'rgba(160,120,80,0.4)';
        for (let u = 6; u < fw; u += 12) t.fillRect(u, 0, 1.5, fh);
      });
    }
    // wooden posts / scaffolding at the corners
    const postH = stage === 1 ? 10 : 22 + stage * 10;
    const posts: [number, number][] = [[0.3, 0.3], [w - 0.3, 0.3], [0.3, d - 0.3], [w - 0.3, d - 0.3]];
    posts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [px, py] of posts) {
      const [sx, sy] = iso.p(px, py, 2);
      c.fillStyle = '#9b6a3a';
      c.fillRect(sx - 1.5, sy - postH, 3, postH);
      c.fillStyle = '#7a4e2d';
      c.fillRect(sx + 0.5, sy - postH, 1, postH);
    }
    if (stage === 1) {
      // string line between stakes
      c.strokeStyle = '#f2c94c';
      c.lineWidth = 1;
      iso.path([[0.3, 0.3, 10], [w - 0.3, 0.3, 10], [w - 0.3, d - 0.3, 10], [0.3, d - 0.3, 10]]);
      c.stroke();
      // a stack of bricks
      iso.box({ x: w / 2 - 0.3, y: d / 2 - 0.2, z: 2, w: 0.6, d: 0.4, h: 5 }, PAL.brick);
    } else {
      // scaffolding planks
      c.strokeStyle = '#b9824a';
      c.lineWidth = 2;
      for (const z of stage === 2 ? [14] : [14, 30]) {
        iso.path([[0.3, d - 0.3, z], [w - 0.3, d - 0.3, z], [w - 0.3, 0.3, z]]);
        c.stroke();
      }
    }
    // striped barrier on the front corner
    const [bx, by] = iso.p(w - 0.2, d - 0.2, 0);
    c.fillStyle = '#f2994a';
    c.fillRect(bx - 9, by - 9, 18, 4);
    c.fillStyle = '#ffffff';
    for (let i = -7; i < 9; i += 6) c.fillRect(bx + i, by - 9, 2.5, 4);
    c.fillStyle = '#555';
    c.fillRect(bx - 8, by - 5, 1.5, 6);
    c.fillRect(bx + 6.5, by - 5, 1.5, 6);
  });
}

export { TW, TH };
