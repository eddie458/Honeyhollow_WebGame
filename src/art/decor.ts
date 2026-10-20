// Decorations: small props that boost nearby payouts.
import { PAL, shade } from './color';
import { Iso, type Box } from './iso';
import { nextLight } from './night';
import { drawProp } from './props';
import { drawTree, frameFor } from './terrain';
import type { SpriteBank } from './atlas';

type DecoFn = (iso: Iso, c: CanvasRenderingContext2D, w: number, d: number) => void;

function flowersOn(c: CanvasRenderingContext2D, iso: Iso, x0: number, y0: number, w: number, d: number, z: number, colors: string[], n: number, seed: number): void {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const fx = x0 + ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * w;
    const fy = y0 + ((Math.sin(i * 78.233 + seed) * 12345.678) % 1 + 1) % 1 * d;
    pts.push([fx, fy, i]);
  }
  pts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [fx, fy, i] of pts) {
    const [sx, sy] = iso.p(fx, fy, z);
    c.fillStyle = '#3f9a3a';
    c.fillRect(sx - 0.5, sy - 4, 1, 4);
    c.fillStyle = colors[i % colors.length]!;
    c.beginPath();
    c.arc(sx, sy - 5, 1.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(sx - 0.6, sy - 5.6, 1, 1);
  }
}

const DECOS: Record<string, DecoFn> = {
  flowerbed(iso, c) {
    iso.box({ x: 0.08, y: 0.08, z: 0, w: 0.84, d: 0.84, h: 4 }, { top: '#6b4a2b', left: '#a5703f', right: '#7a4e2d' });
    flowersOn(c, iso, 0.15, 0.15, 0.7, 0.7, 4, ['#ff6fa3', '#ffd23f', '#ff8a3d', '#b98cf0', '#ffffff'], 9, 3);
  },
  hedge(iso) {
    iso.box({ x: 0.1, y: 0.1, z: 0, w: 0.8, d: 0.8, h: 12 }, { top: '#6cc04a', left: '#4f9d35', right: '#3d7f2a' }, 'rgba(30,60,20,0.5)');
    iso.onFace({ x: 0.1, y: 0.1, z: 0, w: 0.8, d: 0.8, h: 12 }, 'L', (t, fw, fh) => {
      t.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 12; i++) t.fillRect((i * 7) % fw, (i * 5) % fh, 2, 2);
    });
  },
  bench(iso, c) {
    iso.blob(0.5, 0.55, 0.45, 0.18);
    const legs: [number, number][] = [[0.2, 0.35], [0.8, 0.35], [0.2, 0.65], [0.8, 0.65]];
    for (const [x, y] of legs) {
      const [sx, sy] = iso.p(x, y, 0);
      c.fillStyle = '#3b3f45';
      c.fillRect(sx - 0.8, sy - 6, 1.6, 6);
    }
    iso.box({ x: 0.15, y: 0.3, z: 6, w: 0.7, d: 0.4, h: 2 }, '#b9824a');
    iso.box({ x: 0.15, y: 0.3, z: 8, w: 0.7, d: 0.08, h: 7 }, '#a5703f');
  },
  lamppost(iso, c) {
    const lit = nextLight();
    if (lit) {
      // a pool of lamplight on the ground around the post
      const [px, py] = iso.p(0.5, 0.5, 0);
      const pool = c.createRadialGradient(px, py, 2, px, py, 46);
      pool.addColorStop(0, 'rgba(255,214,130,0.55)');
      pool.addColorStop(1, 'rgba(255,214,130,0)');
      c.fillStyle = pool;
      c.beginPath();
      c.ellipse(px, py, 46, 23, 0, 0, Math.PI * 2);
      c.fill();
    }
    iso.blob(0.5, 0.5, 0.25, 0.2);
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    c.fillStyle = '#2f3a45';
    c.fillRect(sx - 1.5, sy - 34, 3, 34);
    c.fillRect(sx - 3, sy - 3, 6, 3);
    const r = lit ? 22 : 8;
    const g = c.createRadialGradient(sx, sy - 38, 1, sx, sy - 38, r);
    g.addColorStop(0, 'rgba(255,240,170,1)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g;
    c.fillRect(sx - r - 1, sy - 39 - r, r * 2 + 2, r * 2 + 2);
    c.fillStyle = lit ? '#fffbe6' : '#fff2b0';
    c.beginPath();
    c.ellipse(sx, sy - 38, 3.5, 4.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2f3a45';
    c.beginPath();
    c.moveTo(sx - 5, sy - 42);
    c.lineTo(sx + 5, sy - 42);
    c.lineTo(sx, sy - 47);
    c.fill();
  },
  shadetree(iso, c) {
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    drawTree(c, sx, sy, 15, 'round');
  },
  bunting(iso, c) {
    const [ax, ay] = iso.p(0.15, 0.85, 0);
    const [bx, by] = iso.p(0.85, 0.15, 0);
    c.fillStyle = '#7a4e2d';
    c.fillRect(ax - 1, ay - 26, 2, 26);
    c.fillRect(bx - 1, by - 26, 2, 26);
    c.strokeStyle = '#555';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(ax, ay - 25);
    c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 16, bx, by - 25);
    c.stroke();
    const colors = ['#e8574a', '#ffd23f', '#4ecdc4', '#b98cf0', '#ff8a3d'];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = ax + (bx - ax) * t;
      const y = ay - 25 + (by - ay) * t + Math.sin(t * Math.PI) * 8.5;
      c.fillStyle = colors[i % colors.length]!;
      c.beginPath();
      c.moveTo(x - 2.5, y);
      c.lineTo(x + 2.5, y);
      c.lineTo(x, y + 5);
      c.fill();
    }
  },
  birdbath(iso, c) {
    iso.blob(0.5, 0.5, 0.3, 0.2);
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    c.fillStyle = '#c9c6bf';
    c.fillRect(sx - 2.5, sy - 12, 5, 12);
    c.beginPath();
    c.ellipse(sx, sy - 13, 9, 4.5, 0, 0, Math.PI * 2);
    c.fillStyle = '#d8d5ce';
    c.fill();
    c.strokeStyle = 'rgba(80,80,80,0.5)';
    c.stroke();
    c.beginPath();
    c.ellipse(sx, sy - 13.5, 7, 3, 0, 0, Math.PI * 2);
    c.fillStyle = PAL.water;
    c.fill();
    drawProp(c, 'pigeon', sx + 5, sy - 18, 7);
  },
  picnic(iso, c) {
    iso.tile(0.2, 0.2, 1.6, 1.6, 'rgba(232,87,74,0.85)', null);
    iso.onTop(0.2, 0.2, 0, (t) => {
      t.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) t.fillRect(i * 8.53, j * 8.53, 8.53, 8.53);
    });
    iso.box({ x: 0.55, y: 0.75, z: 6, w: 0.9, d: 0.5, h: 2 }, '#b9824a');
    const [sx, sy] = iso.p(1, 1, 8);
    drawProp(c, 'apple', sx - 4, sy - 3, 6);
    drawProp(c, 'bread', sx + 4, sy - 2, 7);
  },
  topiary(iso, c) {
    iso.box({ x: 0.25, y: 0.25, z: 0, w: 0.5, d: 0.5, h: 6 }, '#c97a4a');
    const [sx, sy] = iso.p(0.5, 0.5, 6);
    // bee-shaped topiary: two green balls + leafy wings
    c.fillStyle = '#4f9d35';
    c.beginPath();
    c.arc(sx, sy - 9, 8, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(sx, sy - 22, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6cc04a';
    c.beginPath();
    c.arc(sx - 2.5, sy - 12, 4, 0, Math.PI * 2);
    c.arc(sx - 2, sy - 24, 2.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,210,63,0.95)';
    c.fillRect(sx - 6, sy - 11, 12, 2.5);
    c.fillRect(sx - 7, sy - 6, 14, 2.5);
  },
  fountain(iso, c) {
    iso.cylinder(1, 1, 0, 0.78, 7, '#d8d5ce');
    const [sx, sy] = iso.p(1, 1, 7);
    c.beginPath();
    c.ellipse(sx, sy, 0.72 * 45, 0.72 * 22.5, 0, 0, Math.PI * 2);
    c.fillStyle = PAL.water;
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath();
    c.ellipse(sx - 8, sy - 3, 10, 3, 0, 0, Math.PI * 2);
    c.fill();
    iso.cylinder(1, 1, 7, 0.12, 14, '#c9c6bf');
    iso.cylinder(1, 1, 21, 0.32, 3, '#d8d5ce');
    c.strokeStyle = 'rgba(200,235,255,0.9)';
    c.lineWidth = 1.5;
    for (const dx of [-12, -6, 6, 12]) {
      c.beginPath();
      c.moveTo(sx, sy - 24);
      c.quadraticCurveTo(sx + dx * 0.8, sy - 34, sx + dx, sy - 6);
      c.stroke();
    }
  },
  rosearch(iso, c) {
    const posts: [number, number][] = [[0.25, 1.75], [1.75, 0.25]];
    for (const [x, y] of posts) {
      const [sx, sy] = iso.p(x, y, 0);
      c.fillStyle = '#ffffff';
      c.fillRect(sx - 1.5, sy - 30, 3, 30);
    }
    const [ax, ay] = iso.p(0.25, 1.75, 30);
    const [bx, by] = iso.p(1.75, 0.25, 30);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 22, bx, by);
    c.stroke();
    c.strokeStyle = '#4f9d35';
    c.lineWidth = 4;
    c.stroke();
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 11;
      c.fillStyle = i % 2 ? '#ff5d7a' : '#ff9ab0';
      c.beginPath();
      c.arc(x + (i % 3) - 1, y + ((i * 7) % 3) - 1, 2.6, 0, Math.PI * 2);
      c.fill();
    }
    flowersOn(c, iso, 0.1, 1.4, 0.4, 0.5, 0, ['#ff5d7a', '#ff9ab0'], 4, 7);
    flowersOn(c, iso, 1.4, 0.1, 0.5, 0.4, 0, ['#ff5d7a', '#ff9ab0'], 4, 9);
  },
  gazebo(iso, c) {
    iso.cylinder(1, 1, 0, 0.8, 4, '#e8dcc4');
    const posts: [number, number][] = [[0.45, 0.45], [1.55, 0.45], [0.45, 1.55], [1.55, 1.55]];
    for (const [x, y] of posts) {
      const [sx, sy] = iso.p(x, y, 4);
      c.fillStyle = '#ffffff';
      c.fillRect(sx - 1.2, sy - 22, 2.4, 22);
    }
    const [sx, sy] = iso.p(1, 1, 26);
    c.beginPath();
    c.moveTo(sx - 40, sy + 2);
    c.lineTo(sx, sy - 24);
    c.lineTo(sx + 40, sy + 2);
    c.quadraticCurveTo(sx, sy + 16, sx - 40, sy + 2);
    c.closePath();
    const g = c.createLinearGradient(sx - 40, 0, sx + 40, 0);
    g.addColorStop(0, '#5cc6c0');
    g.addColorStop(1, '#2f8f89');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(59,42,30,0.55)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(sx, sy - 25, 2.5, 0, Math.PI * 2);
    c.fill();
  },
  bandstand(iso, c) {
    iso.cylinder(1.5, 1.5, 0, 1.25, 8, '#c9b28a');
    const ring: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ring.push([1.5 + Math.cos(a) * 1.05, 1.5 + Math.sin(a) * 1.05]);
    }
    ring.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of ring) {
      const [sx, sy] = iso.p(x, y, 8);
      c.fillStyle = '#ffffff';
      c.fillRect(sx - 1.3, sy - 26, 2.6, 26);
    }
    const [sx, sy] = iso.p(1.5, 1.5, 34);
    c.beginPath();
    c.moveTo(sx - 64, sy + 4);
    c.lineTo(sx, sy - 30);
    c.lineTo(sx + 64, sy + 4);
    c.quadraticCurveTo(sx, sy + 26, sx - 64, sy + 4);
    c.closePath();
    const g = c.createLinearGradient(sx - 64, 0, sx + 64, 0);
    g.addColorStop(0, '#ff7f6e');
    g.addColorStop(1, '#c8483c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(59,42,30,0.55)';
    c.stroke();
    c.fillStyle = '#ffffff';
    for (let i = -56; i <= 56; i += 14) {
      c.beginPath();
      c.arc(sx + i, sy + 4 + (1 - Math.abs(i) / 64) * 9, 3, 0, Math.PI);
      c.fill();
    }
    const [mx, my] = iso.p(1.5, 1.5, 8);
    // a little music note (drawn, not text)
    c.fillStyle = '#3b2a1e';
    c.beginPath();
    c.ellipse(mx - 3, my - 10, 3, 2.2, -0.4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(mx - 0.5, my - 22, 1.5, 12);
    c.fillRect(mx - 0.5, my - 22, 6, 1.5);
  },
  beestatue(iso, c) {
    iso.box({ x: 0.45, y: 0.45, z: 0, w: 1.1, d: 1.1, h: 14 }, '#d8d5ce');
    iso.box({ x: 0.35, y: 0.35, z: 14, w: 1.3, d: 1.3, h: 3 }, '#c9c6bf');
    const [sx, sy] = iso.p(1, 1, 17);
    drawProp(c, 'bee', sx, sy - 16, 30);
  },
  clockpost(iso, c) {
    iso.blob(0.5, 0.5, 0.3, 0.2);
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    c.fillStyle = '#2f5d50';
    c.fillRect(sx - 2, sy - 40, 4, 40);
    c.fillRect(sx - 4, sy - 4, 8, 4);
    for (const dx of [-7, 7]) {
      c.beginPath();
      c.arc(sx + dx, sy - 44, 6, 0, Math.PI * 2);
      c.fillStyle = '#2f5d50';
      c.fill();
      c.beginPath();
      c.arc(sx + dx, sy - 44, 4.5, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
      c.strokeStyle = '#2b2b35';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(sx + dx, sy - 44);
      c.lineTo(sx + dx, sy - 47);
      c.moveTo(sx + dx, sy - 44);
      c.lineTo(sx + dx + 2, sy - 43);
      c.stroke();
    }
    c.fillStyle = '#f2c94c';
    c.beginPath();
    c.arc(sx, sy - 52, 2.5, 0, Math.PI * 2);
    c.fill();
  },
  // ---- seasonal: Harvest Festival
  pumpkinstack(iso, c) {
    iso.blob(0.5, 0.55, 0.42, 0.22);
    iso.box({ x: 0.16, y: 0.16, z: 0, w: 0.68, d: 0.68, h: 8 }, { top: '#f2d16b', left: '#e0b84a', right: '#c99e35' });
    iso.onFace({ x: 0.16, y: 0.16, z: 0, w: 0.68, d: 0.68, h: 8 }, 'L', (t, fw) => {
      t.strokeStyle = 'rgba(150,110,30,0.6)';
      t.lineWidth = 0.8;
      for (let u = 3; u < fw; u += 4) {
        t.beginPath();
        t.moveTo(u, 1);
        t.lineTo(u - 2, 7);
        t.stroke();
      }
    });
    const [sx, sy] = iso.p(0.5, 0.5, 8);
    pumpkin(c, sx - 7, sy - 3, 7);
    pumpkin(c, sx + 7, sy - 1, 6);
    pumpkin(c, sx, sy - 12, 7.5);
  },
  harvestwagon(iso, c, w, d) {
    iso.blob(w / 2, d / 2, 0.95, 0.24);
    const bed: Box = { x: 0.35, y: 0.55, z: 9, w: w - 0.7, d: d - 1.1, h: 9 };
    // wheels on the near side, axle hidden under the bed
    for (const x of [0.6, w - 0.6]) {
      const [wx, wy] = iso.p(x, d - 0.5, 9);
      c.fillStyle = '#6b4a2b';
      c.beginPath();
      c.ellipse(wx, wy, 8, 9, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#3b2a1e';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = '#c99e6b';
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        c.beginPath();
        c.moveTo(wx - Math.cos(a) * 7, wy - Math.sin(a) * 8);
        c.lineTo(wx + Math.cos(a) * 7, wy + Math.sin(a) * 8);
        c.stroke();
      }
    }
    iso.box(bed, { top: '#a5703f', left: '#c48a4a', right: '#9a6435' });
    iso.onFace(bed, 'L', (t, fw, fh) => {
      t.fillStyle = 'rgba(70,40,15,0.35)';
      for (let u = 6; u < fw; u += 9) t.fillRect(u, 0, 1.2, fh);
    });
    // the load: pumpkins and corn
    const [cx, cy] = iso.p(w / 2, d / 2 - 0.05, 18);
    c.fillStyle = '#f2d16b';
    for (let k = -2; k <= 2; k++) {
      c.save();
      c.translate(cx + k * 6, cy - 6);
      c.rotate(k * 0.35);
      c.beginPath();
      c.ellipse(0, -6, 3, 9, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7ed957';
      c.beginPath();
      c.ellipse(0, 3, 2.5, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2d16b';
      c.restore();
    }
    pumpkin(c, cx - 12, cy + 2, 7);
    pumpkin(c, cx + 13, cy + 3, 6.5);
    pumpkin(c, cx, cy + 4, 8);
  },
  // ---- seasonal: Winter Lights
  snowman(iso, c) {
    iso.blob(0.5, 0.55, 0.36, 0.2);
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    const ball = (y: number, r: number) => {
      const g = c.createRadialGradient(sx - r * 0.4, y - r * 0.4, r * 0.2, sx, y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#cfe3f2');
      c.fillStyle = g;
      c.beginPath();
      c.arc(sx, y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(59,42,30,0.45)';
      c.lineWidth = 1.2;
      c.stroke();
    };
    ball(sy - 9, 10);
    ball(sy - 24, 7.5);
    ball(sy - 36, 6);
    c.fillStyle = '#d7263d';
    c.fillRect(sx - 7, sy - 31, 14, 3);
    c.fillRect(sx + 3, sy - 31, 3, 8);
    c.fillStyle = '#2f3a45';
    c.fillRect(sx - 6, sy - 44, 12, 2);
    c.fillRect(sx - 4, sy - 52, 8, 8);
    c.beginPath();
    c.arc(sx - 2.2, sy - 37.5, 0.9, 0, Math.PI * 2);
    c.arc(sx + 2.2, sy - 37.5, 0.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff8a3d';
    c.beginPath();
    c.moveTo(sx, sy - 36);
    c.lineTo(sx + 7, sy - 34.5);
    c.lineTo(sx, sy - 34);
    c.fill();
  },
  lighttree(iso, c) {
    const [sx, sy] = iso.p(0.5, 0.5, 0);
    drawTree(c, sx, sy, 16, 'pine');
    // string lights that really glow after dark
    const lit = nextLight();
    const bulbs = [[-7, -14], [5, -18], [-3, -24], [8, -28], [-6, -32], [2, -38], [-2, -46], [5, -44]] as const;
    const colors = ['#ff6b6b', '#ffd23f', '#6bc4ff', '#9fe870'];
    bulbs.forEach(([dx, dy], i) => {
      const x = sx + dx;
      const y = sy + dy;
      if (lit) {
        const g = c.createRadialGradient(x, y, 0.5, x, y, 7);
        g.addColorStop(0, `${colors[i % 4]}ee`);
        g.addColorStop(1, `${colors[i % 4]}00`);
        c.fillStyle = g;
        c.fillRect(x - 7, y - 7, 14, 14);
      }
      c.fillStyle = lit ? '#fffbe6' : colors[i % 4]!;
      c.beginPath();
      c.arc(x, y, lit ? 1.8 : 1.6, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = lit ? '#fff4b0' : '#ffd23f';
    drawProp(c, 'star', sx, sy - 56, lit ? 13 : 11);
  },
  goldenhive(iso, c) {
    iso.box({ x: 0.4, y: 0.4, z: 0, w: 1.2, d: 1.2, h: 10 }, '#f3e3bf');
    const [sx, sy] = iso.p(1, 1, 10);
    const g = c.createRadialGradient(sx, sy - 24, 2, sx, sy - 22, 30);
    g.addColorStop(0, 'rgba(255,240,150,0.7)');
    g.addColorStop(1, 'rgba(255,240,150,0)');
    c.fillStyle = g;
    c.fillRect(sx - 30, sy - 52, 60, 52);
    drawProp(c, 'hive', sx, sy - 20, 36);
    drawProp(c, 'bee', sx + 14, sy - 40, 10);
    drawProp(c, 'bee', sx - 16, sy - 32, 8);
  },
};

/** A ribbed pumpkin with a stem, centred at (x, y). */
function pumpkin(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = '#f08a24';
  c.beginPath();
  c.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(120,50,10,0.55)';
  c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(x + k * r * 0.8, y, r * 0.35, r * 0.82, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = 'rgba(59,42,30,0.6)';
  c.beginPath();
  c.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(255,230,180,0.45)';
  c.beginPath();
  c.ellipse(x - r * 0.45, y - r * 0.35, r * 0.3, r * 0.18, -0.4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5b7a2b';
  c.fillRect(x - 1, y - r * 0.85 - 3, 2, 4);
}

export function hasDeco(name: string): boolean {
  return name in DECOS;
}

export function drawDeco(bank: SpriteBank, key: string, name: string, w: number, d: number): void {
  const fn = DECOS[name];
  if (!fn) return;
  const top = 70 + Math.max(w, d) * 10;
  // lamps get extra room for their pool of light at night (trimmed away by day)
  const f = frameFor(w, d, top, name === 'lamppost' ? 30 : 10, name === 'lamppost' ? 16 : 6);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    fn(iso, c, w, d);
  });
}

export { shade };
