// One-off art: pier (dock grows with upgrades), boats, the railway, station and
// train, the two wonders and the two landmarks.
import { PAL, shade } from './color';
import { flowerClump } from './flora';
import { HW, Iso, rect, windowPane, type Box } from './iso';
import { nextLight } from './night';
import { drawProp, signBoard } from './props';
import { drawTree, frameFor } from './terrain';
import type { SpriteBank } from './atlas';

const OUT = 'rgba(59,42,30,0.55)';

// ------------------------------------------------------------------- pier --

/** Pier on a 4x3 shore footprint; the dock reaches `dockLen` tiles into the sea (+y). */
export function drawPier(bank: SpriteBank, key: string, level: number): void {
  const w = 4;
  const d = 3;
  const dockLen = 2.6 + level * 1.5;
  const f = frameFor(w, d + dockLen, 70, 10, 10);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    // sandy yard
    iso.tile(0.05, 0.05, w - 0.1, d - 0.1, PAL.sand, null);
    // dock posts in the water
    const posts: [number, number][] = [];
    for (let y = d + 0.4; y < d + dockLen; y += 1.1) {
      posts.push([1.2, y], [2.8, y]);
    }
    posts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of posts) {
      const [sx, sy] = iso.p(x, y, -2);
      c.fillStyle = '#6e4426';
      c.fillRect(sx - 2, sy - 6, 4, 10);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(sx, sy + 3, 6, 2, 0, 0, Math.PI * 2);
      c.fill();
    }
    // deck planks
    const deck: Box = { x: 1.0, y: d - 0.2, z: 2, w: 2.0, d: dockLen + 0.2, h: 3 };
    iso.box(deck, { top: '#c99a5c', left: '#a5703f', right: '#8a5a2b' });
    iso.onTop(deck.x, deck.y, deck.z + deck.h, (t) => {
      t.strokeStyle = 'rgba(90,55,25,0.45)';
      t.lineWidth = 1;
      for (let v = 6; v < deck.d * 32; v += 6) {
        t.beginPath();
        t.moveTo(0, v);
        t.lineTo(deck.w * 32, v);
        t.stroke();
      }
    });
    // bollards
    for (let y = d + 0.7; y < d + dockLen; y += 1.5) {
      const [sx, sy] = iso.p(2.85, y, 5);
      c.fillStyle = '#3b3f45';
      c.fillRect(sx - 1.5, sy - 4, 3, 4);
    }
    // harbor office
    const office: Box = { x: 0.3, y: 0.3, z: 0, w: 1.6, d: 1.4, h: 18 };
    iso.shadow(office, 24);
    iso.box(office, '#e9eef2');
    iso.onFace(office, 'L', (t, fw, fh) => {
      windowPane(t, 5, 5, 8, 7, '#ffffff', PAL.glass);
      t.fillStyle = '#2f5d7a';
      t.fillRect(fw - 14, fh - 13, 8, 13);
    });
    iso.hip(office, 9, '#3f7fb5');
    // crates & barrels
    iso.box({ x: 2.4, y: 0.4, z: 0, w: 0.7, d: 0.7, h: 9 }, '#c48a4a');
    iso.box({ x: 3.15, y: 0.5, z: 0, w: 0.6, d: 0.6, h: 7 }, '#b07a3c');
    iso.box({ x: 2.6, y: 0.5, z: 9, w: 0.5, d: 0.5, h: 6 }, '#d9a066');
    iso.cylinder(3.3, 1.7, 0, 0.22, 9, '#4f7cac');
    // little crane
    const [cx, cy] = iso.p(0.6, 2.4, 0);
    c.strokeStyle = '#e8a93a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx, cy - 40);
    c.lineTo(cx + 34, cy - 30);
    c.stroke();
    c.strokeStyle = '#3b2a1e';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + 30, cy - 31);
    c.lineTo(cx + 30, cy - 16);
    c.stroke();
    drawProp(c, 'crate', cx + 30, cy - 12, 9);
    // flag with an anchor
    const [fx, fy] = iso.p(1.1, 0.4, 18);
    c.fillStyle = '#6b6e73';
    c.fillRect(fx - 0.75, fy - 20, 1.5, 20);
    c.fillStyle = '#ffffff';
    c.fillRect(fx + 0.75, fy - 20, 12, 8);
    drawProp(c, 'anchor', fx + 6.5, fy - 16, 7);
  });
}

export function drawBoat(bank: SpriteBank, key: string): void {
  bank.draw(key, 90, 80, 45, 60, (c) => {
    const iso = new Iso(c, 45, 60);
    // wake
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath();
    c.ellipse(45, 62, 30, 8, -0.46, 0, Math.PI * 2);
    c.fill();
    const hull: Box = { x: -0.35, y: -0.8, z: -2, w: 0.7, d: 1.5, h: 7 };
    iso.box(hull, { top: '#f4f1e8', left: '#e8574a', right: '#b8382d' });
    // prow
    iso.poly([[hull.x, hull.y + hull.d, -2], [hull.x + hull.w, hull.y + hull.d, -2], [0, hull.y + hull.d + 0.45, 5], [hull.x + hull.w, hull.y + hull.d, 5], [hull.x, hull.y + hull.d, 5]], '#d94a3f');
    iso.poly([[hull.x, hull.y + hull.d, 5], [hull.x + hull.w, hull.y + hull.d, 5], [0, hull.y + hull.d + 0.45, 5]], '#f4f1e8');
    // cabin + crates
    iso.box({ x: -0.25, y: -0.7, z: 5, w: 0.5, d: 0.45, h: 9 }, '#ffffff');
    iso.box({ x: -0.25, y: -0.7, z: 14, w: 0.5, d: 0.45, h: 2 }, '#3f7fb5');
    iso.box({ x: -0.25, y: -0.1, z: 5, w: 0.5, d: 0.5, h: 6 }, '#c48a4a');
    iso.box({ x: -0.2, y: 0.45, z: 5, w: 0.4, d: 0.35, h: 5 }, '#4ecdc4');
    const [sx, sy] = iso.p(0, -0.5, 16);
    c.fillStyle = '#3b3f45';
    c.fillRect(sx - 1, sy - 8, 2, 8);
  });
}

// -------------------------------------------------------------------- rail --

/** A 3x3 piece of railway running along y. */
export function drawRail(bank: SpriteBank, key: string): void {
  const f = frameFor(3, 3, 6, 1, 2);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.onTop(0, 0, 0, (t) => {
      t.fillStyle = '#b9ad94';
      t.fillRect(14, 0, 68, 96);
      t.fillStyle = 'rgba(80,70,55,0.25)';
      for (let i = 0; i < 70; i++) t.fillRect(14 + ((i * 37) % 68), (i * 53) % 96, 2, 2);
      // sleepers
      t.fillStyle = '#7a4e2d';
      for (let v = 3; v < 96; v += 10) t.fillRect(20, v, 56, 5);
    });
    // rails (slightly raised)
    iso.onTop(0, 0, 2, (t) => {
      t.fillStyle = '#8a96a3';
      t.fillRect(32, 0, 4, 96);
      t.fillRect(60, 0, 4, 96);
      t.fillStyle = '#d8dde2';
      t.fillRect(32, 0, 1.5, 96);
      t.fillRect(60, 0, 1.5, 96);
    });
  });
}

/** Train along the y axis. dir 0 = heading -y (away, up-right), 1 = heading +y (towards viewer). */
export function drawTrain(bank: SpriteBank, key: string, dir: 0 | 1): void {
  bank.draw(key, 190, 160, 95, 110, (c) => {
    const iso = new Iso(c, 95, 110);
    const cars: { y: number; kind: 'loco' | 'box' | 'tank' }[] = dir === 0
      ? [{ y: -2.2, kind: 'loco' }, { y: -0.6, kind: 'box' }, { y: 1.0, kind: 'tank' }]
      : [{ y: -2.2, kind: 'tank' }, { y: -0.6, kind: 'box' }, { y: 1.0, kind: 'loco' }];
    for (const car of cars) {
      const b: Box = { x: -0.4, y: car.y, z: 3, w: 0.8, d: 1.4, h: car.kind === 'loco' ? 14 : 12 };
      iso.poly([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w + 0.25, b.y + 0.1, 0], [b.x + b.w + 0.25, b.y + b.d, 0], [b.x + 0.1, b.y + b.d, 0]], 'rgba(25,35,15,0.25)', null);
      for (const wy of [b.y + 0.25, b.y + b.d - 0.25]) {
        const [sx, sy] = iso.p(b.x + b.w, wy, 3);
        c.fillStyle = '#2b2b35';
        c.beginPath();
        c.ellipse(sx, sy, 3.2, 3.6, 0, 0, Math.PI * 2);
        c.fill();
      }
      if (car.kind === 'loco') {
        iso.box(b, '#c8483c');
        const cab: Box = { x: b.x + 0.05, y: dir === 0 ? b.y + b.d - 0.55 : b.y, z: b.z + b.h, w: b.w - 0.1, d: 0.55, h: 9 };
        iso.box(cab, '#2a9d8f');
        iso.onFace(cab, 'R', (t, fw) => {
          t.fillStyle = '#8fd3f4';
          t.fillRect(3, 2, fw - 6, 4);
        });
        const stack = dir === 0 ? b.y + 0.3 : b.y + b.d - 0.3;
        iso.cylinder(0, stack, b.z + b.h, 0.14, 10, '#3b3f45');
        // puff of steam
        const [px, py] = iso.p(0, stack, b.z + b.h + 16);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [dx, dy, r] of [[0, 0, 5], [6, -5, 6], [13, -9, 7]] as const) {
          c.beginPath();
          c.arc(px + dx, py + dy, r, 0, Math.PI * 2);
          c.fill();
        }
        iso.onFace(b, 'R', (t, fw, fh) => {
          t.fillStyle = '#ffd23f';
          t.fillRect(0, fh - 4, fw, 2);
        });
      } else if (car.kind === 'box') {
        iso.box(b, '#d9a066');
        iso.onFace(b, 'R', (t, fw, fh) => {
          t.strokeStyle = 'rgba(80,50,20,0.5)';
          for (let u = 4; u < fw; u += 6) {
            t.beginPath();
            t.moveTo(u, 1);
            t.lineTo(u, fh - 1);
            t.stroke();
          }
          drawProp(t, 'crate', fw / 2, fh / 2, 9);
        });
      } else {
        iso.box({ ...b, h: 4 }, '#5b6b7a');
        iso.cylinder(0, b.y + b.d / 2, b.z + 4, 0.38, 10, '#e8dcc4');
      }
    }
  });
}

/** Railway station (5x4), sits beside the track on its +x side. */
export function drawStation(bank: SpriteBank, key: string): void {
  const w = 5;
  const d = 4;
  const f = frameFor(w, d, 100, 14, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0.1, 0.1, w - 0.2, d - 0.2, PAL.sidewalk, 'rgba(120,110,95,0.35)');
    // platform along the track
    iso.box({ x: w - 1.3, y: 0.2, z: 0, w: 1.2, d: d - 0.4, h: 4 }, '#d8d1c0');
    iso.onTop(w - 1.3, 0.2, 4, (t) => {
      t.fillStyle = '#ffd23f';
      t.fillRect(32, 0, 4, (d - 0.4) * 32);
    });
    const hall: Box = { x: 0.4, y: 0.6, z: 0, w: 2.4, d: d - 1.2, h: 26 };
    iso.shadow(hall, 40);
    iso.box(hall, PAL.brick);
    iso.onFace(hall, 'L', (t, fw, fh) => {
      t.fillStyle = 'rgba(90,30,20,0.18)';
      for (let v = 3; v < fh; v += 4) for (let u = (Math.floor(v / 4) % 2) * 4; u < fw; u += 8) t.fillRect(u, v, 6, 0.8);
      windowPane(t, 6, 6, 10, 12, '#f3e3bf', PAL.glass, true);
      windowPane(t, fw - 16, 6, 10, 12, '#f3e3bf', PAL.glass, true);
    });
    iso.onFace(hall, 'R', (t, fw, fh) => {
      t.fillStyle = '#5b3a1a';
      t.fillRect(fw / 2 - 6, fh - 16, 12, 16);
      signBoard(t, fw / 2, 7, 26, 11, '#fff4e0', 'train');
    });
    iso.gable(hall, 16, 'y', '#5b6b7a', 0.15, OUT, PAL.brick);
    // clock on the gable
    const [kx, ky] = iso.p(hall.x + hall.w / 2, hall.y + hall.d, hall.h + 7);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(kx, ky, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3b2a1e';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.moveTo(kx, ky);
    c.lineTo(kx, ky - 3.5);
    c.moveTo(kx, ky);
    c.lineTo(kx + 2.5, ky + 0.5);
    c.stroke();
    // platform canopy
    const posts: [number, number][] = [[w - 1.1, 0.5], [w - 1.1, d - 0.6], [w - 0.3, 0.5], [w - 0.3, d - 0.6]];
    for (const [x, y] of posts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]))) {
      const [sx, sy] = iso.p(x, y, 4);
      c.fillStyle = '#2f5d50';
      c.fillRect(sx - 1, sy - 18, 2, 18);
    }
    iso.box({ x: w - 1.35, y: 0.3, z: 22, w: 1.3, d: d - 0.6, h: 3 }, { top: '#2f8f89', left: '#3e8e8a', right: '#2a6f6b' });
    // benches
    iso.box({ x: w - 0.95, y: 1.6, z: 4, w: 0.3, d: 0.8, h: 3 }, '#a5703f');
  });
}

// ----------------------------------------------------------------- wonders --

export function drawGreatHive(bank: SpriteBank, key: string): void {
  const f = frameFor(5, 5, 170, 20, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0.1, 0.1, 4.8, 4.8, shade(PAL.lawn, 0.08), null);
    // a ring of flower clumps, back to front (small enough to stay clear of the hive)
    const ring: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ring.push([2.5 + Math.cos(a) * 2.15, 2.5 + Math.sin(a) * 2.15]);
    }
    ring.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    ring.forEach(([x, y], i) => {
      const [sx, sy] = iso.p(x, y, 0);
      flowerClump(c, sx, sy, 4, ['#ff6fa3', '#ffd23f', '#ffffff', '#b98cf0'], 900 + i);
    });
    iso.shadow({ x: 0.7, y: 0.7, w: 3.6, d: 3.6 }, 120);
    iso.cylinder(2.5, 2.5, 0, 1.75, 10, '#f3e3bf');
    const [sx, sy] = iso.p(2.5, 2.5, 10);
    // stacked skep rings
    const rings = 7;
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const rx = 92 * (1 - Math.pow(t, 2.2) * 0.75);
      const ry = rx * 0.42;
      const y = sy - i * 17;
      const g = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(0.5, i % 2 ? '#f2b93b' : '#f5c95a');
      g.addColorStop(1, '#c9890f');
      c.beginPath();
      c.ellipse(sx, y, rx, ry + 8, 0, 0, Math.PI * 2);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = 'rgba(120,70,10,0.5)';
      c.lineWidth = 1.5;
      c.stroke();
    }
    // honeycomb windows
    const hex = (hx: number, hy: number, r: number) => {
      c.beginPath();
      for (let k = 0; k < 6; k++) c.lineTo(hx + Math.cos((k * Math.PI) / 3) * r, hy + Math.sin((k * Math.PI) / 3) * r);
      c.closePath();
      c.fillStyle = '#8fd3f4';
      c.fill();
      c.strokeStyle = '#a86b08';
      c.lineWidth = 2;
      c.stroke();
    };
    hex(sx - 34, sy - 36, 9);
    hex(sx, sy - 44, 9);
    hex(sx + 34, sy - 36, 9);
    hex(sx - 17, sy - 64, 8);
    hex(sx + 17, sy - 64, 8);
    // door
    c.fillStyle = '#5b3a1a';
    c.beginPath();
    c.ellipse(sx, sy - 6, 14, 18, 0, Math.PI, 0);
    c.lineTo(sx + 14, sy + 6);
    c.lineTo(sx - 14, sy + 6);
    c.fill();
    // crown + bees
    drawProp(c, 'star', sx, sy - 128, 20);
    drawProp(c, 'bee', sx - 66, sy - 92, 16);
    drawProp(c, 'bee', sx + 70, sy - 70, 14);
    drawProp(c, 'bee', sx + 30, sy - 120, 12);
  });
}

export function drawSkyGarden(bank: SpriteBank, key: string): void {
  const f = frameFor(5, 5, 250, 20, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0.1, 0.1, 4.8, 4.8, PAL.sidewalk, 'rgba(120,110,95,0.3)');
    iso.shadow({ x: 1, y: 1, w: 3, d: 3 }, 200);
    const tiers = [
      { s: 3.0, h: 54 },
      { s: 2.4, h: 52 },
      { s: 1.8, h: 50 },
    ];
    let z = 0;
    for (const tier of tiers) {
      const o = (5 - tier.s) / 2;
      const b: Box = { x: o, y: o, z, w: tier.s, d: tier.s, h: tier.h };
      iso.box(b, { top: '#cfe9f2', left: '#a9d8ea', right: '#7fb8cf' });
      iso.onFace(b, 'L', (t, fw, fh) => {
        t.strokeStyle = 'rgba(255,255,255,0.6)';
        t.lineWidth = 1;
        for (let u = 6; u < fw; u += 8) {
          t.beginPath();
          t.moveTo(u, 0);
          t.lineTo(u, fh);
          t.stroke();
        }
        for (let v = 8; v < fh; v += 10) {
          t.beginPath();
          t.moveTo(0, v);
          t.lineTo(fw, v);
          t.stroke();
        }
      });
      iso.onFace(b, 'R', (t, fw, fh) => {
        t.strokeStyle = 'rgba(255,255,255,0.4)';
        for (let u = 6; u < fw; u += 8) {
          t.beginPath();
          t.moveTo(u, 0);
          t.lineTo(u, fh);
          t.stroke();
        }
      });
      z += tier.h;
      // garden terrace with hanging greenery
      iso.box({ x: o - 0.15, y: o - 0.15, z, w: tier.s + 0.3, d: tier.s + 0.3, h: 4 }, { top: '#6cc04a', left: '#4f9d35', right: '#3d7f2a' });
      for (let i = 0; i < 6; i++) {
        const [tx, ty] = iso.p(o + 0.2 + (i % 3) * (tier.s / 3), o + tier.s + 0.1 - Math.floor(i / 3) * (tier.s - 0.4), z + 4);
        drawTree(c, tx, ty, 6 + (i % 2) * 2, i % 3 === 0 ? 'pine' : 'round');
      }
      z += 4;
    }
    const [sx, sy] = iso.p(2.5, 2.5, z);
    c.fillStyle = '#e8eef2';
    c.beginPath();
    c.moveTo(sx - 5, sy);
    c.lineTo(sx, sy - 46);
    c.lineTo(sx + 5, sy);
    c.fill();
    drawProp(c, 'flowers', sx, sy - 52, 20);
  });
}

// --------------------------------------------------------------- franchise --

/** A 4x4 Empty Lot where neighbors can open a franchise: gravel, a low fence and a signpost. */
export function drawEmptyLot(bank: SpriteBank, key: string): void {
  const n = 4;
  const f = frameFor(n, n, 70, 10, 6);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0.08, 0.08, n - 0.16, n - 0.16, '#cdb894', 'rgba(110,85,55,0.45)');
    // gravel speckles
    iso.onTop(0.1, 0.1, 0, (t) => {
      for (let i = 0; i < 90; i++) {
        const u = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const v = ((Math.sin(i * 78.233) * 12345.678) % 1 + 1) % 1;
        t.fillStyle = i % 3 ? 'rgba(120,95,60,0.35)' : 'rgba(255,248,230,0.45)';
        t.fillRect(u * (n - 0.2) * 32, v * (n - 0.2) * 32, 2.2, 1.4);
      }
    });
    // low picket fence along the two back edges
    const fence = (x0: number, y0: number, x1: number, y1: number) => {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const [sx, sy] = iso.p(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
        c.fillStyle = '#fff8e7';
        c.fillRect(sx - 1, sy - 9, 2, 9);
      }
      const [ax, ay] = iso.p(x0, y0);
      const [bx, by] = iso.p(x1, y1);
      c.strokeStyle = '#fff8e7';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(ax, ay - 6);
      c.lineTo(bx, by - 6);
      c.stroke();
    };
    fence(0.15, 0.15, n - 0.15, 0.15);
    fence(0.15, 0.15, 0.15, n - 0.15);
    // signpost: "your shop here"
    const [px, py] = iso.p(n * 0.62, n * 0.62);
    iso.blob(n * 0.62, n * 0.62, 0.3, 0.2);
    c.fillStyle = '#7a4e2d';
    c.fillRect(px - 1.5, py - 34, 3, 34);
    signBoard(c, px, py - 40, 34, 20, '#fff4e0', 'bag');
    c.fillStyle = '#2a9d8f';
    c.beginPath();
    c.arc(px + 15, py - 49, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(px + 12.5, py - 49.8, 5, 1.6);
    c.fillRect(px + 14.2, py - 52.5, 1.6, 7);
  });
}

// --------------------------------------------------------------- landmarks --

export function drawLighthouse(bank: SpriteBank, key: string): void {
  const f = frameFor(4, 4, 210, 16, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    // rocky base
    iso.tile(0.1, 0.1, 3.8, 3.8, PAL.sand, null);
    for (const [x, y, r] of [[0.8, 2.9, 0.6], [2.9, 3.1, 0.7], [3.2, 1.0, 0.5], [1.6, 3.4, 0.5]] as const) {
      const [sx, sy] = iso.p(x, y);
      c.fillStyle = '#8a8f96';
      c.beginPath();
      c.ellipse(sx, sy - 4, r * 22, r * 13, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#b5bcc4';
      c.beginPath();
      c.ellipse(sx - 4, sy - 7, r * 12, r * 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    // keeper's cottage
    const hut: Box = { x: 0.3, y: 0.4, z: 0, w: 1.3, d: 1.2, h: 16 };
    iso.box(hut, '#ffffff');
    iso.gable(hut, 12, 'x', '#c8483c', 0.12, OUT, '#ffffff');
    // tower with stripes
    const tx = 2.4;
    const ty = 1.9;
    const H = 120;
    iso.shadow({ x: tx - 0.6, y: ty - 0.6, w: 1.2, d: 1.2 }, H);
    iso.cylinder(tx, ty, 0, 0.62, 10, '#d8d5ce');
    const [bx, by] = iso.p(tx, ty, 10);
    const r0 = 0.55 * HW * 1.414;
    const r1 = 0.38 * HW * 1.414;
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const y0 = by - (H / bands) * i;
      const y1 = by - (H / bands) * (i + 1);
      const ra = r0 + (r1 - r0) * (i / bands);
      const rb = r0 + (r1 - r0) * ((i + 1) / bands);
      const g = c.createLinearGradient(bx - ra, 0, bx + ra, 0);
      const base = i % 2 ? '#ffffff' : '#e8574a';
      g.addColorStop(0, shade(base, 0.1));
      g.addColorStop(1, shade(base, -0.28));
      c.beginPath();
      c.moveTo(bx - ra, y0);
      c.ellipse(bx, y0, ra, ra / 2, 0, Math.PI, 0, true);
      c.lineTo(bx + rb, y1);
      c.ellipse(bx, y1, rb, rb / 2, 0, 0, Math.PI, false);
      c.closePath();
      c.fillStyle = g;
      c.fill();
    }
    const topY = by - H;
    // gallery + lantern
    c.fillStyle = '#3b3f45';
    c.beginPath();
    c.ellipse(bx, topY, r1 + 8, (r1 + 8) / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,240,170,0.95)';
    c.fillRect(bx - r1 + 3, topY - 20, (r1 - 3) * 2, 20);
    c.strokeStyle = '#3b3f45';
    c.lineWidth = 1.5;
    for (let u = -r1 + 3; u <= r1 - 3; u += 6) {
      c.beginPath();
      c.moveTo(bx + u, topY);
      c.lineTo(bx + u, topY - 20);
      c.stroke();
    }
    // the lamp burns brighter (and wider) at night
    const lamp = nextLight() ? 72 : 40;
    const glow = c.createRadialGradient(bx, topY - 10, 2, bx, topY - 10, lamp);
    glow.addColorStop(0, lamp > 40 ? 'rgba(255,244,190,0.95)' : 'rgba(255,240,170,0.6)');
    glow.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = glow;
    c.fillRect(bx - lamp, topY - 10 - lamp, lamp * 2, lamp * 2);
    c.fillStyle = '#c8483c';
    c.beginPath();
    c.ellipse(bx, topY - 20, r1 + 2, (r1 + 2) / 2, 0, Math.PI, 0);
    c.lineTo(bx, topY - 36);
    c.closePath();
    c.fill();
  });
}

export function drawObservatory(bank: SpriteBank, key: string): void {
  const f = frameFor(5, 5, 150, 18, 8);
  bank.draw(key, f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    iso.tile(0.1, 0.1, 4.8, 4.8, PAL.sidewalk, 'rgba(120,110,95,0.3)');
    const base: Box = { x: 0.5, y: 0.5, z: 0, w: 4, d: 4, h: 34 };
    iso.shadow(base, 90);
    iso.box(base, '#f3ead6');
    for (const face of ['L', 'R'] as const) {
      iso.onFace(base, face, (t, fw, fh) => {
        const cols = 6;
        for (let i = 0; i < cols; i++) {
          const u = 6 + ((fw - 12) / (cols - 1)) * i;
          rect(t, u - 2, 4, 4, fh - 4, '#ffffff');
        }
        if (face === 'L') {
          t.fillStyle = '#2f4858';
          t.fillRect(fw / 2 - 7, fh - 18, 14, 18);
        }
      });
    }
    iso.flatRoof(base, '#d8d1c0');
    // dome with slit and telescope
    iso.cylinder(2.5, 2.5, 38, 1.35, 12, '#e8eef2');
    iso.dome(2.5, 2.5, 50, 1.35, 52, '#c9d6e3');
    const [sx, sy] = iso.p(2.5, 2.5, 50);
    c.fillStyle = '#2b3a4a';
    c.beginPath();
    c.moveTo(sx - 6, sy);
    c.lineTo(sx - 4, sy - 50);
    c.lineTo(sx + 4, sy - 50);
    c.lineTo(sx + 6, sy);
    c.fill();
    c.save();
    c.translate(sx, sy - 30);
    c.rotate(-0.7);
    c.fillStyle = '#8a96a3';
    c.fillRect(-4, -34, 8, 34);
    c.fillStyle = '#5b6b7a';
    c.fillRect(-5, -38, 10, 6);
    c.restore();
    drawProp(c, 'star', sx + 40, sy - 70, 14);
    drawProp(c, 'star', sx - 46, sy - 56, 10);
  });
}
