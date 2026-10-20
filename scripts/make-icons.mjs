// Draws the PNG app icons (same bee as public/icons/icon.svg) without any
// dependencies: a tiny anti-aliased rasteriser plus a PNG encoder.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const INK = hex('#3b2a1e');

/** Point inside an ellipse centred at (cx, cy), radii rx/ry, rotated by deg. */
function inEllipse(x, y, cx, cy, rx, ry, deg = 0) {
  const a = (-deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(a) - dy * Math.sin(a);
  const v = dx * Math.sin(a) + dy * Math.cos(a);
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
}

function ellipse(cx, cy, rx, ry, deg, fill, stroke, sw) {
  const shapes = [];
  if (stroke) shapes.push({ hit: (x, y) => inEllipse(x, y, cx, cy, rx + sw / 2, ry + sw / 2, deg), color: () => stroke });
  shapes.push({ hit: (x, y) => inEllipse(x, y, cx, cy, rx - (stroke ? sw / 2 : 0), ry - (stroke ? sw / 2 : 0), deg), color: () => fill });
  return shapes;
}

/** The bee, in the 64x64 units of the SVG, placed with offset + scale. */
function bee(ox, oy, k) {
  const X = (x) => ox + x * k;
  const Y = (y) => oy + y * k;
  const shapes = [
    ...ellipse(X(22), Y(18), 12 * k, 8 * k, -25, hex('#ffffff', 0.92), INK, 2.5 * k),
    ...ellipse(X(42), Y(18), 12 * k, 8 * k, 25, hex('#ffffff', 0.92), INK, 2.5 * k),
    ...ellipse(X(32), Y(38), 20 * k, 16 * k, 0, hex('#ffd23f'), INK, 3 * k),
  ];
  const body = (x, y) => inEllipse(x, y, X(32), Y(38), 20 * k - 1.5 * k, 16 * k - 1.5 * k);
  for (const sx of [22, 32, 42]) {
    shapes.push({ hit: (x, y) => body(x, y) && Math.abs(x - X(sx)) <= 2.5 * k, color: () => INK });
  }
  shapes.push({ hit: (x, y) => inEllipse(x, y, X(45.5), Y(34.5), 2.8 * k, 2.8 * k), color: () => INK });
  shapes.push({ hit: (x, y) => inEllipse(x, y, X(46.4), Y(33.6), 0.9 * k, 0.9 * k), color: () => hex('#ffffff') });
  return shapes;
}

function background(size, radius) {
  const inRound = (x, y) => {
    const r = radius;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const stops = [
    [0, hex('#ffe7a3')],
    [0.55, hex('#f5a623')],
    [1, hex('#d9820a')],
  ];
  const grad = (x, y) => {
    const t = Math.min(1, Math.hypot(x - size * 0.5, y - size * 0.35) / (size * 0.75));
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    const f = (t - t0) / (t1 - t0);
    return c0.map((v, j) => (j < 3 ? v + (c1[j] - v) * f : 1));
  };
  return { hit: radius > 0 ? inRound : () => true, color: grad };
}

function render(size, maskable) {
  const s = size / 512;
  const shapes = [background(512, maskable ? 0 : 112), ...(maskable ? bee(96, 92, 5) : bee(64, 60, 6))];
  const SS = 4;
  const px = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) / s;
          const y = (py + (sy + 0.5) / SS) / s;
          let cr = 0, cg = 0, cb = 0, ca = 0;
          for (const sh of shapes) {
            if (!sh.hit(x, y)) continue;
            const [sr, sg, sb, sa] = sh.color(x, y);
            cr = sr * sa + cr * (1 - sa);
            cg = sg * sa + cg * (1 - sa);
            cb = sb * sa + cb * (1 - sa);
            ca = sa + ca * (1 - sa);
          }
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS;
      const i = (py * size + pxi) * 4;
      const alpha = a / n;
      px[i] = alpha ? Math.round(r / n / alpha) : 0;
      px[i + 1] = alpha ? Math.round(g / n / alpha) : 0;
      px[i + 2] = alpha ? Math.round(b / n / alpha) : 0;
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return png(size, size, px);
}

// ------------------------------------------------------------------ PNG ---

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no filter
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [file, size, maskable] of [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/icon-maskable-512.png', 512, true],
]) {
  writeFileSync(file, render(size, maskable));
  console.log('wrote', file);
}
