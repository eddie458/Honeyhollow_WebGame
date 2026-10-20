// Upright "caricature" props and sign icons, drawn as 2D billboards. Each
// draws centred on (cx, cy) with a nominal size s (roughly its height).
import { shade } from './color';

type PropFn = (c: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void;

const OUT = 'rgba(59,42,30,0.75)';

function blob(c: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 1): void {
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = OUT;
  c.lineWidth = lw;
  c.stroke();
}

function radial(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): CanvasGradient {
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, shade(color, 0.4));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.25));
  return g;
}

export const PROPS: Record<string, PropFn> = {
  croissant(c, cx, cy, s) {
    const r = s * 0.5;
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / (segs - 1));
      const px = cx - Math.cos(a) * r * 0.9;
      const py = cy + r * 0.35 - Math.sin(a) * r * 0.7;
      const size = r * (i === 2 ? 0.48 : i === 1 || i === 3 ? 0.4 : 0.3);
      c.beginPath();
      c.ellipse(px, py, size, size * 0.8, a - Math.PI / 2, 0, Math.PI * 2);
      blob(c, radial(c, px, py, size, '#e0a043'));
    }
    c.strokeStyle = 'rgba(140,80,20,0.6)';
    c.lineWidth = 1;
  },
  cup(c, cx, cy, s) {
    const w = s * 0.62;
    const h = s * 0.5;
    const top = cy - h * 0.2;
    // steam
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = Math.max(1.5, s * 0.07);
    for (const dx of [-w * 0.22, w * 0.12]) {
      c.beginPath();
      c.moveTo(cx + dx, top - 2);
      c.bezierCurveTo(cx + dx - s * 0.12, top - s * 0.2, cx + dx + s * 0.12, top - s * 0.3, cx + dx, top - s * 0.45);
      c.stroke();
    }
    // saucer
    c.beginPath();
    c.ellipse(cx, top + h, w * 0.8, h * 0.18, 0, 0, Math.PI * 2);
    blob(c, '#ffffff');
    // handle
    c.beginPath();
    c.ellipse(cx + w * 0.5, top + h * 0.45, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    c.strokeStyle = OUT;
    c.lineWidth = Math.max(2.5, s * 0.08);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = Math.max(1.5, s * 0.05);
    c.stroke();
    // body
    c.beginPath();
    c.moveTo(cx - w / 2, top);
    c.lineTo(cx + w / 2, top);
    c.quadraticCurveTo(cx + w * 0.45, top + h, cx, top + h);
    c.quadraticCurveTo(cx - w * 0.45, top + h, cx - w / 2, top);
    c.closePath();
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d9e3ea');
    blob(c, g);
    c.fillStyle = '#e8574a';
    c.fillRect(cx - w * 0.42, top + h * 0.3, w * 0.84, h * 0.16);
    c.beginPath();
    c.ellipse(cx, top, w / 2, h * 0.14, 0, 0, Math.PI * 2);
    blob(c, '#7a4e2d');
  },
  flowers(c, cx, cy, s) {
    const potW = s * 0.5;
    const potTop = cy + s * 0.05;
    const colors = ['#ff6fa3', '#ffd23f', '#ff8a3d', '#b98cf0', '#ff5d6c'];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.38;
      const fx = cx + Math.cos(a) * s * 0.42;
      const fy = potTop + Math.sin(a) * s * 0.5;
      c.strokeStyle = '#3f9a3a';
      c.lineWidth = Math.max(1, s * 0.05);
      c.beginPath();
      c.moveTo(cx, potTop);
      c.lineTo(fx, fy);
      c.stroke();
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        c.beginPath();
        c.arc(fx + Math.cos(pa) * s * 0.07, fy + Math.sin(pa) * s * 0.07, s * 0.07, 0, Math.PI * 2);
        c.fillStyle = colors[i]!;
        c.fill();
      }
      c.beginPath();
      c.arc(fx, fy, s * 0.045, 0, Math.PI * 2);
      c.fillStyle = '#fff2a8';
      c.fill();
    }
    c.beginPath();
    c.moveTo(cx - potW / 2, potTop);
    c.lineTo(cx + potW / 2, potTop);
    c.lineTo(cx + potW * 0.36, potTop + s * 0.4);
    c.lineTo(cx - potW * 0.36, potTop + s * 0.4);
    c.closePath();
    blob(c, '#d9744a');
    c.fillStyle = '#e88a5f';
    c.fillRect(cx - potW / 2, potTop, potW, s * 0.07);
  },
  top(c, cx, cy, s) {
    const r = s * 0.4;
    c.beginPath();
    c.moveTo(cx - r, cy);
    c.quadraticCurveTo(cx, cy - r * 1.2, cx + r, cy);
    c.lineTo(cx, cy + r * 1.1);
    c.closePath();
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, '#ff6b6b');
    g.addColorStop(0.33, '#ffd23f');
    g.addColorStop(0.66, '#4ecdc4');
    g.addColorStop(1, '#5c7cfa');
    blob(c, g);
    c.fillStyle = '#7a4e2d';
    c.fillRect(cx - s * 0.04, cy - r * 1.05, s * 0.08, r * 0.6);
    c.beginPath();
    c.arc(cx, cy - r * 1.05, s * 0.07, 0, Math.PI * 2);
    blob(c, '#c8483c');
  },
  burger(c, cx, cy, s) {
    const w = s * 0.75;
    const y0 = cy - s * 0.35;
    c.beginPath();
    c.ellipse(cx, y0 + s * 0.12, w / 2, s * 0.22, 0, Math.PI, 0);
    c.lineTo(cx + w / 2, y0 + s * 0.14);
    c.lineTo(cx - w / 2, y0 + s * 0.14);
    blob(c, radial(c, cx, y0, w / 2, '#e9a84c'));
    c.fillStyle = '#fff3d6';
    for (const [dx, dy] of [[-0.18, 0.02], [0.05, -0.04], [0.2, 0.04], [-0.04, 0.06]]) {
      c.beginPath();
      c.ellipse(cx + dx! * w, y0 + dy! * s, s * 0.025, s * 0.015, 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#5cb043';
    c.beginPath();
    for (let i = 0; i <= 8; i++) c.lineTo(cx - w / 2 - 2 + (i * (w + 4)) / 8, y0 + s * 0.16 + (i % 2) * s * 0.05);
    c.lineTo(cx + w / 2 + 2, y0 + s * 0.24);
    c.lineTo(cx - w / 2 - 2, y0 + s * 0.24);
    c.fill();
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.moveTo(cx - w / 2, y0 + s * 0.22);
    c.lineTo(cx + w / 2, y0 + s * 0.22);
    c.lineTo(cx + w * 0.1, y0 + s * 0.34);
    c.closePath();
    c.fill();
    c.beginPath();
    c.roundRect(cx - w / 2, y0 + s * 0.25, w, s * 0.13, s * 0.06);
    blob(c, '#7a3e1d');
    c.beginPath();
    c.roundRect(cx - w / 2, y0 + s * 0.38, w, s * 0.13, s * 0.06);
    blob(c, '#e9a84c');
  },
  shake(c, cx, cy, s) {
    const w = s * 0.42;
    const top = cy - s * 0.15;
    c.strokeStyle = '#e8574a';
    c.lineWidth = Math.max(1.5, s * 0.06);
    c.beginPath();
    c.moveTo(cx + w * 0.1, top - s * 0.2);
    c.lineTo(cx + w * 0.45, top - s * 0.5);
    c.stroke();
    c.beginPath();
    c.arc(cx - w * 0.12, top - s * 0.14, s * 0.13, 0, Math.PI * 2);
    c.arc(cx + w * 0.15, top - s * 0.12, s * 0.12, 0, Math.PI * 2);
    blob(c, '#fffaf0');
    c.beginPath();
    c.arc(cx, top - s * 0.3, s * 0.06, 0, Math.PI * 2);
    blob(c, '#d7263d');
    c.beginPath();
    c.moveTo(cx - w / 2, top);
    c.lineTo(cx + w / 2, top);
    c.lineTo(cx + w * 0.28, top + s * 0.55);
    c.lineTo(cx - w * 0.28, top + s * 0.55);
    c.closePath();
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#ffc2d9');
    g.addColorStop(1, '#f28bb3');
    blob(c, g);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(cx - w * 0.3, top + s * 0.05, w * 0.12, s * 0.4);
  },
  eightball(c, cx, cy, s) {
    const r = s * 0.42;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    blob(c, radial(c, cx, cy, r, '#2b2b35'));
    c.beginPath();
    c.arc(cx - r * 0.15, cy - r * 0.15, r * 0.42, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = '#2b2b35';
    c.lineWidth = Math.max(1.2, r * 0.09);
    c.beginPath();
    c.arc(cx - r * 0.15, cy - r * 0.27, r * 0.11, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(cx - r * 0.15, cy - r * 0.04, r * 0.13, 0, Math.PI * 2);
    c.stroke();
  },
  sushi(c, cx, cy, s) {
    const r = s * 0.36;
    for (const dx of [-r * 0.9, r * 0.9]) {
      c.beginPath();
      c.ellipse(cx + dx, cy + r * 0.2, r * 0.8, r * 0.95, 0, 0, Math.PI * 2);
      blob(c, '#1f3b2d');
      c.beginPath();
      c.ellipse(cx + dx, cy, r * 0.8, r * 0.36, 0, 0, Math.PI * 2);
      blob(c, '#fbfbf5');
      c.beginPath();
      c.ellipse(cx + dx, cy, r * 0.32, r * 0.16, 0, 0, Math.PI * 2);
      c.fillStyle = '#ff8c69';
      c.fill();
    }
    c.strokeStyle = '#a5703f';
    c.lineWidth = Math.max(1.5, s * 0.05);
    c.beginPath();
    c.moveTo(cx - r * 1.6, cy - r * 1.2);
    c.lineTo(cx + r * 1.4, cy - r * 0.5);
    c.moveTo(cx - r * 1.5, cy - r * 1.45);
    c.lineTo(cx + r * 1.5, cy - r * 0.75);
    c.stroke();
  },
  bread(c, cx, cy, s) {
    const w = s * 0.8;
    c.beginPath();
    c.ellipse(cx, cy, w / 2, s * 0.3, 0, 0, Math.PI * 2);
    blob(c, radial(c, cx, cy, w / 2, '#d9954a'));
    c.strokeStyle = '#f6d9a8';
    c.lineWidth = Math.max(1, s * 0.05);
    for (const dx of [-0.2, 0, 0.2]) {
      c.beginPath();
      c.moveTo(cx + dx * w - s * 0.06, cy - s * 0.12);
      c.lineTo(cx + dx * w + s * 0.06, cy + s * 0.04);
      c.stroke();
    }
  },
  envelope(c, cx, cy, s) {
    const w = s * 0.85;
    const h = s * 0.58;
    c.beginPath();
    c.rect(cx - w / 2, cy - h / 2, w, h);
    blob(c, '#ffffff');
    c.beginPath();
    c.moveTo(cx - w / 2, cy - h / 2);
    c.lineTo(cx, cy + h * 0.08);
    c.lineTo(cx + w / 2, cy - h / 2);
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.arc(cx, cy + h * 0.06, s * 0.09, 0, Math.PI * 2);
    blob(c, '#d7263d');
  },
  book(c, cx, cy, s) {
    const w = s * 0.46;
    const h = s * 0.6;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx, cy - h * 0.4);
      c.quadraticCurveTo(cx + side * w * 0.5, cy - h * 0.55, cx + side * w, cy - h * 0.45);
      c.lineTo(cx + side * w, cy + h * 0.45);
      c.quadraticCurveTo(cx + side * w * 0.5, cy + h * 0.35, cx, cy + h * 0.5);
      c.closePath();
      blob(c, side < 0 ? '#ffffff' : '#f1ece0');
      c.strokeStyle = 'rgba(80,80,80,0.35)';
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(cx + side * w * 0.15, cy - h * 0.3 + i * h * 0.18);
        c.lineTo(cx + side * w * 0.85, cy - h * 0.32 + i * h * 0.18);
        c.stroke();
      }
    }
    c.fillStyle = '#3e8e8a';
    c.fillRect(cx - w, cy + h * 0.45, w * 2, s * 0.08);
  },
  apple(c, cx, cy, s) {
    const r = s * 0.36;
    c.beginPath();
    c.moveTo(cx, cy - r * 0.6);
    c.bezierCurveTo(cx - r * 1.6, cy - r * 1.3, cx - r * 1.3, cy + r * 1.3, cx, cy + r);
    c.bezierCurveTo(cx + r * 1.3, cy + r * 1.3, cx + r * 1.6, cy - r * 1.3, cx, cy - r * 0.6);
    blob(c, radial(c, cx, cy, r, '#e3343f'));
    c.fillStyle = '#7a4e2d';
    c.fillRect(cx - s * 0.03, cy - r * 1.1, s * 0.06, r * 0.5);
    c.beginPath();
    c.ellipse(cx + r * 0.35, cy - r * 0.95, r * 0.35, r * 0.16, -0.5, 0, Math.PI * 2);
    blob(c, '#5cb043');
  },
  heart(c, cx, cy, s) {
    const r = s * 0.42;
    c.beginPath();
    c.moveTo(cx, cy + r);
    c.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.45);
    c.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.5, cy - r * 0.1, cx, cy + r);
    blob(c, radial(c, cx, cy, r, '#ff5d7a'));
  },
  bell(c, cx, cy, s) {
    const r = s * 0.4;
    c.beginPath();
    c.moveTo(cx - r, cy + r * 0.6);
    c.quadraticCurveTo(cx - r * 0.85, cy - r, cx, cy - r);
    c.quadraticCurveTo(cx + r * 0.85, cy - r, cx + r, cy + r * 0.6);
    c.closePath();
    blob(c, radial(c, cx, cy, r, '#f2c94c'));
    c.beginPath();
    c.arc(cx, cy + r * 0.7, r * 0.2, 0, Math.PI * 2);
    blob(c, '#c99a2e');
  },
  bed(c, cx, cy, s) {
    const w = s * 0.85;
    c.beginPath();
    c.roundRect(cx - w / 2, cy - s * 0.05, w, s * 0.25, 2);
    blob(c, '#4f7cac');
    c.beginPath();
    c.roundRect(cx - w / 2, cy - s * 0.32, s * 0.12, s * 0.62, 2);
    blob(c, '#7a4e2d');
    c.beginPath();
    c.ellipse(cx - w * 0.22, cy - s * 0.12, s * 0.15, s * 0.08, 0, 0, Math.PI * 2);
    blob(c, '#ffffff');
  },
  fish(c, cx, cy, s) {
    const r = s * 0.42;
    c.beginPath();
    c.moveTo(cx - r, cy);
    c.quadraticCurveTo(cx - r * 0.2, cy - r * 0.75, cx + r * 0.6, cy);
    c.quadraticCurveTo(cx - r * 0.2, cy + r * 0.75, cx - r, cy);
    blob(c, radial(c, cx, cy, r, '#ff8c69'));
    c.beginPath();
    c.moveTo(cx + r * 0.5, cy);
    c.lineTo(cx + r, cy - r * 0.45);
    c.lineTo(cx + r, cy + r * 0.45);
    c.closePath();
    blob(c, '#ff7043');
    c.beginPath();
    c.arc(cx - r * 0.55, cy - r * 0.1, s * 0.04, 0, Math.PI * 2);
    c.fillStyle = '#2b2b35';
    c.fill();
  },
  flame(c, cx, cy, s) {
    const r = s * 0.4;
    c.beginPath();
    c.moveTo(cx, cy - r * 1.2);
    c.bezierCurveTo(cx + r * 1.2, cy - r * 0.2, cx + r * 0.9, cy + r, cx, cy + r);
    c.bezierCurveTo(cx - r * 0.9, cy + r, cx - r * 1.2, cy - r * 0.2, cx, cy - r * 1.2);
    blob(c, '#ff7a29');
    c.beginPath();
    c.moveTo(cx, cy - r * 0.3);
    c.bezierCurveTo(cx + r * 0.6, cy + r * 0.2, cx + r * 0.4, cy + r * 0.85, cx, cy + r * 0.85);
    c.bezierCurveTo(cx - r * 0.4, cy + r * 0.85, cx - r * 0.6, cy + r * 0.2, cx, cy - r * 0.3);
    c.fillStyle = '#ffd23f';
    c.fill();
  },
  crate(c, cx, cy, s) {
    const w = s * 0.7;
    c.beginPath();
    c.rect(cx - w / 2, cy - w / 2, w, w);
    blob(c, '#c48a4a');
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = Math.max(1, s * 0.06);
    c.strokeRect(cx - w / 2 + 2, cy - w / 2 + 2, w - 4, w - 4);
    c.beginPath();
    c.moveTo(cx - w / 2 + 2, cy - w / 2 + 2);
    c.lineTo(cx + w / 2 - 2, cy + w / 2 - 2);
    c.stroke();
  },
  gift(c, cx, cy, s) {
    const w = s * 0.7;
    c.beginPath();
    c.rect(cx - w / 2, cy - w * 0.35, w, w * 0.8);
    blob(c, '#b98cf0');
    c.fillStyle = '#ffd23f';
    c.fillRect(cx - s * 0.06, cy - w * 0.35, s * 0.12, w * 0.8);
    c.beginPath();
    c.ellipse(cx - s * 0.12, cy - w * 0.45, s * 0.12, s * 0.07, 0.5, 0, Math.PI * 2);
    c.ellipse(cx + s * 0.12, cy - w * 0.45, s * 0.12, s * 0.07, -0.5, 0, Math.PI * 2);
    blob(c, '#ffd23f');
  },
  bag(c, cx, cy, s) {
    const w = s * 0.62;
    c.strokeStyle = OUT;
    c.lineWidth = Math.max(1.5, s * 0.06);
    c.beginPath();
    c.arc(cx, cy - s * 0.22, s * 0.16, Math.PI, 0);
    c.stroke();
    c.beginPath();
    c.rect(cx - w / 2, cy - s * 0.22, w, s * 0.6);
    blob(c, '#ff8fb1');
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(cx, cy + s * 0.08, s * 0.1, 0, Math.PI * 2);
    c.fill();
  },
  reel(c, cx, cy, s) {
    const r = s * 0.42;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    blob(c, radial(c, cx, cy, r, '#5b6b7a'));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.beginPath();
      c.arc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.2, 0, Math.PI * 2);
      c.fillStyle = '#2b2b35';
      c.fill();
    }
  },
  pigeon(c, cx, cy, s) {
    const r = s * 0.35;
    c.beginPath();
    c.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2);
    blob(c, '#aab4c3');
    c.beginPath();
    c.arc(cx + r * 0.8, cy - r * 0.55, r * 0.42, 0, Math.PI * 2);
    blob(c, '#9aa6b8');
    c.fillStyle = '#f2994a';
    c.beginPath();
    c.moveTo(cx + r * 1.2, cy - r * 0.6);
    c.lineTo(cx + r * 1.5, cy - r * 0.45);
    c.lineTo(cx + r * 1.2, cy - r * 0.38);
    c.fill();
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(cx + r * 0.92, cy - r * 0.65, r * 0.08, 0, Math.PI * 2);
    c.fill();
  },
  hay(c, cx, cy, s) {
    const w = s * 0.8;
    c.beginPath();
    c.roundRect(cx - w / 2, cy - s * 0.25, w, s * 0.5, s * 0.1);
    blob(c, '#e9c46a');
    c.strokeStyle = 'rgba(150,110,30,0.6)';
    c.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      c.beginPath();
      c.moveTo(cx - w / 2 + (i * w) / 5, cy - s * 0.25);
      c.lineTo(cx - w / 2 + (i * w) / 5, cy + s * 0.25);
      c.stroke();
    }
  },
  key(c, cx, cy, s) {
    const r = s * 0.2;
    c.beginPath();
    c.arc(cx - s * 0.2, cy, r, 0, Math.PI * 2);
    blob(c, '#f2c94c');
    c.beginPath();
    c.rect(cx - s * 0.05, cy - s * 0.06, s * 0.5, s * 0.12);
    blob(c, '#f2c94c');
    c.beginPath();
    c.rect(cx + s * 0.3, cy, s * 0.07, s * 0.16);
    blob(c, '#f2c94c');
    c.beginPath();
    c.arc(cx - s * 0.2, cy, r * 0.4, 0, Math.PI * 2);
    c.fillStyle = '#c99a2e';
    c.fill();
  },
  star(c, cx, cy, s) {
    const r = s * 0.45;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    blob(c, radial(c, cx, cy, r, '#ffd23f'));
  },
  cupcake(c, cx, cy, s) {
    const w = s * 0.55;
    c.beginPath();
    c.moveTo(cx - w / 2, cy);
    c.lineTo(cx + w / 2, cy);
    c.lineTo(cx + w * 0.35, cy + s * 0.38);
    c.lineTo(cx - w * 0.35, cy + s * 0.38);
    c.closePath();
    blob(c, '#4ecdc4');
    c.beginPath();
    c.arc(cx - w * 0.2, cy - s * 0.04, s * 0.17, 0, Math.PI * 2);
    c.arc(cx + w * 0.2, cy - s * 0.04, s * 0.17, 0, Math.PI * 2);
    c.arc(cx, cy - s * 0.18, s * 0.18, 0, Math.PI * 2);
    blob(c, '#ffc2d9');
    c.beginPath();
    c.arc(cx, cy - s * 0.38, s * 0.07, 0, Math.PI * 2);
    blob(c, '#d7263d');
  },
  tools(c, cx, cy, s) {
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.6);
    c.beginPath();
    c.rect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.55);
    blob(c, '#a5703f');
    c.beginPath();
    c.rect(-s * 0.25, -s * 0.28, s * 0.5, s * 0.18);
    blob(c, '#8a96a3');
    c.restore();
  },
  hive(c, cx, cy, s) {
    const r = s * 0.42;
    for (let i = 0; i < 4; i++) {
      const w = r * (1.1 - Math.abs(i - 1.5) * 0.25);
      c.beginPath();
      c.ellipse(cx, cy - r * 0.6 + i * r * 0.42, w, r * 0.26, 0, 0, Math.PI * 2);
      blob(c, i % 2 ? '#e8a93a' : '#f2c14e');
    }
    c.beginPath();
    c.ellipse(cx, cy + r * 0.45, r * 0.18, r * 0.14, 0, 0, Math.PI * 2);
    c.fillStyle = '#5b3a1a';
    c.fill();
  },
  bee(c, cx, cy, s) {
    const r = s * 0.3;
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(cx - r * 0.3, cy - r * 0.9, r * 0.5, r * 0.35, -0.5, 0, Math.PI * 2);
    c.ellipse(cx + r * 0.3, cy - r * 0.9, r * 0.5, r * 0.35, 0.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx, cy, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
    blob(c, '#ffd23f');
    c.fillStyle = '#2b2b35';
    c.fillRect(cx - r * 0.35, cy - r * 0.78, r * 0.25, r * 1.56);
    c.fillRect(cx + r * 0.2, cy - r * 0.75, r * 0.25, r * 1.5);
  },
  anchor(c, cx, cy, s) {
    c.strokeStyle = '#2f4858';
    c.lineWidth = Math.max(2, s * 0.09);
    c.beginPath();
    c.arc(cx, cy - s * 0.32, s * 0.09, 0, Math.PI * 2);
    c.moveTo(cx, cy - s * 0.23);
    c.lineTo(cx, cy + s * 0.35);
    c.moveTo(cx - s * 0.18, cy - s * 0.1);
    c.lineTo(cx + s * 0.18, cy - s * 0.1);
    c.moveTo(cx - s * 0.3, cy + s * 0.12);
    c.quadraticCurveTo(cx - s * 0.25, cy + s * 0.38, cx, cy + s * 0.38);
    c.quadraticCurveTo(cx + s * 0.25, cy + s * 0.38, cx + s * 0.3, cy + s * 0.12);
    c.stroke();
  },
  train(c, cx, cy, s) {
    const w = s * 0.8;
    c.beginPath();
    c.roundRect(cx - w / 2, cy - s * 0.2, w * 0.65, s * 0.35, 3);
    blob(c, '#c8483c');
    c.beginPath();
    c.roundRect(cx + w * 0.1, cy - s * 0.38, w * 0.4, s * 0.53, 3);
    blob(c, '#3e8e8a');
    c.fillStyle = '#2b2b35';
    for (const dx of [-0.3, 0, 0.3]) {
      c.beginPath();
      c.arc(cx + dx * w, cy + s * 0.2, s * 0.09, 0, Math.PI * 2);
      c.fill();
    }
  },
  ticket(c, cx, cy, s) {
    const w = s * 0.8;
    c.beginPath();
    c.roundRect(cx - w / 2, cy - s * 0.22, w, s * 0.44, 3);
    blob(c, '#ffd23f');
    c.setLineDash([2, 2]);
    c.beginPath();
    c.moveTo(cx + w * 0.2, cy - s * 0.2);
    c.lineTo(cx + w * 0.2, cy + s * 0.2);
    c.stroke();
    c.setLineDash([]);
  },
};

export function drawProp(c: CanvasRenderingContext2D, name: string, cx: number, cy: number, s: number): void {
  const fn = PROPS[name];
  if (fn) {
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    fn(c, cx, cy, s);
    c.restore();
  }
}

/** Rounded sign board with an icon (signs read through icons, never words). */
export function signBoard(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, bg: string, icon: string): void {
  c.save();
  c.beginPath();
  c.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(5, h / 3));
  c.fillStyle = bg;
  c.fill();
  c.strokeStyle = shade(bg, -0.45);
  c.lineWidth = 1.2;
  c.stroke();
  c.beginPath();
  c.roundRect(cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4, Math.min(4, h / 3));
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 1;
  c.stroke();
  drawProp(c, icon, cx, cy, h * 0.78);
  c.restore();
}
