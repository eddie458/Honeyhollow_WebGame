// Citizens (big-headed walkers), tourists and vehicles.
import { shade } from './color';
import { Iso } from './iso';
import { drawProp } from './props';
import type { SpriteBank } from './atlas';

export interface CitizenLook {
  skin: string;
  hair: string;
  style: 'short' | 'long' | 'bun' | 'cap' | 'hat';
  shirt: string;
  pants: string;
  tourist?: boolean;
}

const SKINS = ['#f6d3b3', '#e8b48a', '#c98e62', '#a46a43', '#7a4a2c'];
const HAIRS = ['#3b2a1e', '#6b3e1f', '#d9a441', '#2b2b35', '#b5533c', '#8a8f96'];
const SHIRTS = ['#e8574a', '#4ecdc4', '#5c7cfa', '#ffd23f', '#b98cf0', '#ff8a3d', '#5cb043', '#ff6fa3'];
const PANTS = ['#34495e', '#5b6b7a', '#7a4e2d', '#2f3a45'];
const STYLES: CitizenLook['style'][] = ['short', 'long', 'bun', 'cap', 'short', 'long'];

export function citizenLooks(): CitizenLook[] {
  const out: CitizenLook[] = [];
  for (let i = 0; i < 12; i++) {
    out.push({
      skin: SKINS[i % SKINS.length]!,
      hair: HAIRS[(i * 7) % HAIRS.length]!,
      style: STYLES[(i * 5) % STYLES.length]!,
      shirt: SHIRTS[(i * 3) % SHIRTS.length]!,
      pants: PANTS[(i * 11) % PANTS.length]!,
    });
  }
  for (let i = 0; i < 4; i++) {
    out.push({
      skin: SKINS[(i * 2 + 1) % SKINS.length]!,
      hair: HAIRS[(i * 3) % HAIRS.length]!,
      style: 'hat',
      shirt: ['#ff8a3d', '#4ecdc4', '#ff6fa3', '#ffd23f'][i]!,
      pants: '#f3e3bf',
      tourist: true,
    });
  }
  return out;
}

/** dir 0 = facing viewer (walking +x / +y), 1 = facing away. frame 0..2 */
export function drawCitizen(bank: SpriteBank, key: string, look: CitizenLook, dir: 0 | 1, frame: number): void {
  const W = 18;
  const H = 32;
  bank.draw(key, W, H, W / 2, H - 2, (c) => {
    const cx = W / 2;
    const foot = H - 2;
    // shadow
    c.fillStyle = 'rgba(25,35,15,0.28)';
    c.beginPath();
    c.ellipse(cx + 1, foot, 5, 2, 0, 0, Math.PI * 2);
    c.fill();
    const swing = frame === 1 ? 0 : frame === 0 ? 1.6 : -1.6;
    // legs
    c.strokeStyle = look.pants;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - 1.6, foot - 9);
    c.lineTo(cx - 1.6 + swing, foot - 1);
    c.moveTo(cx + 1.6, foot - 9);
    c.lineTo(cx + 1.6 - swing, foot - 1);
    c.stroke();
    c.fillStyle = '#3b2a1e';
    c.fillRect(cx - 2.8 + swing, foot - 1.5, 2.4, 1.5);
    c.fillRect(cx + 0.4 - swing, foot - 1.5, 2.4, 1.5);
    // body
    c.beginPath();
    c.roundRect(cx - 4, foot - 17, 8, 9, 3);
    const g = c.createLinearGradient(cx - 4, 0, cx + 4, 0);
    g.addColorStop(0, shade(look.shirt, 0.15));
    g.addColorStop(1, shade(look.shirt, -0.15));
    c.fillStyle = g;
    c.fill();
    if (look.tourist) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) c.fillRect(cx - 3 + (i % 2) * 3, foot - 16 + i * 2, 1.5, 1.5);
    }
    // arms
    c.strokeStyle = shade(look.shirt, -0.1);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 4, foot - 15);
    c.lineTo(cx - 5 - swing * 0.5, foot - 10);
    c.moveTo(cx + 4, foot - 15);
    c.lineTo(cx + 5 + swing * 0.5, foot - 10);
    c.stroke();
    // head (big!)
    const hy = foot - 22.5;
    c.beginPath();
    c.arc(cx, hy, 6, 0, Math.PI * 2);
    c.fillStyle = look.skin;
    c.fill();
    c.strokeStyle = 'rgba(59,42,30,0.45)';
    c.lineWidth = 0.8;
    c.stroke();
    // hair / hats
    c.fillStyle = look.hair;
    if (dir === 1) {
      c.beginPath();
      c.arc(cx, hy - 0.5, 6.1, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.arc(cx, hy - 1, 6.1, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fill();
    }
    if (look.style === 'long') {
      c.fillRect(cx - 6, hy - 1, 2.2, 7);
      c.fillRect(cx + 3.8, hy - 1, 2.2, 7);
    } else if (look.style === 'bun') {
      c.beginPath();
      c.arc(cx, hy - 7, 2.6, 0, Math.PI * 2);
      c.fill();
    } else if (look.style === 'cap') {
      c.fillStyle = shade(look.shirt, -0.2);
      c.beginPath();
      c.arc(cx, hy - 1.5, 6.2, Math.PI, 0);
      c.fill();
      if (dir === 0) c.fillRect(cx - 1, hy - 2.2, 7.5, 1.8);
    } else if (look.style === 'hat') {
      c.fillStyle = '#f6e3a1';
      c.beginPath();
      c.ellipse(cx, hy - 3, 9, 2.6, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(cx, hy - 4, 4.5, Math.PI, 0);
      c.fill();
      c.fillStyle = '#e8574a';
      c.fillRect(cx - 4.5, hy - 5, 9, 1.4);
    }
    if (dir === 0) {
      c.fillStyle = '#2b2b35';
      c.fillRect(cx - 2.6, hy + 0.2, 1.3, 1.6);
      c.fillRect(cx + 1.3, hy + 0.2, 1.3, 1.6);
      c.strokeStyle = 'rgba(120,50,40,0.8)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.arc(cx, hy + 2.6, 1.6, 0.2, Math.PI - 0.2);
      c.stroke();
      c.fillStyle = 'rgba(255,120,120,0.35)';
      c.fillRect(cx - 4.2, hy + 2, 1.6, 1);
      c.fillRect(cx + 2.6, hy + 2, 1.6, 1);
      if (look.tourist) {
        // camera
        c.fillStyle = '#2b2b35';
        c.fillRect(cx - 2.5, foot - 13, 5, 3);
        c.fillStyle = '#8fd3f4';
        c.fillRect(cx - 0.6, foot - 12.5, 1.5, 1.5);
      }
    }
  });
}

export type VehicleKind = 'van' | 'bus' | 'car1' | 'car2' | 'car3';

const VEHICLES: Record<VehicleKind, { body: string; top: string; len: number; wid: number; h: number; icon?: string }> = {
  van: { body: '#ffffff', top: '#f2a93b', len: 1.7, wid: 0.75, h: 16, icon: 'heart' },
  bus: { body: '#ffd23f', top: '#3e8e8a', len: 2.3, wid: 0.8, h: 18 },
  car1: { body: '#e8574a', top: '#ffffff', len: 1.2, wid: 0.65, h: 10 },
  car2: { body: '#5c7cfa', top: '#ffffff', len: 1.2, wid: 0.65, h: 10 },
  car3: { body: '#5cb043', top: '#ffffff', len: 1.2, wid: 0.65, h: 10 },
};

/** dir 0 = driving +x (towards the lower right), 1 = driving -x. Anchor = centre. */
export function drawVehicle(bank: SpriteBank, key: string, kind: VehicleKind, dir: 0 | 1): void {
  const v = VEHICLES[kind];
  const W = 110;
  const H = 80;
  bank.draw(key, W, H, W / 2, H - 22, (c) => {
    const iso = new Iso(c, W / 2, H - 22);
    const x0 = -v.len / 2;
    const y0 = -v.wid / 2;
    iso.poly([[x0 + 0.1, y0 + 0.1, 0], [x0 + v.len + 0.25, y0 + 0.1, 0], [x0 + v.len + 0.25, y0 + v.wid + 0.12, 0], [x0 + 0.1, y0 + v.wid + 0.12, 0]], 'rgba(25,35,15,0.25)', null);
    // wheels
    const wheel = (x: number, y: number) => {
      const [sx, sy] = iso.p(x, y, 3);
      c.fillStyle = '#2b2b35';
      c.beginPath();
      c.ellipse(sx, sy, 3.2, 3.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#9aa0a6';
      c.beginPath();
      c.ellipse(sx, sy, 1.3, 1.5, 0, 0, Math.PI * 2);
      c.fill();
    };
    wheel(x0 + 0.3, y0 + v.wid);
    wheel(x0 + v.len - 0.3, y0 + v.wid);
    const cabLen = kind === 'van' ? 0.5 : 0;
    const front = dir === 0 ? x0 + v.len - cabLen : x0;
    if (kind === 'van') {
      // cargo box + cab
      const boxX = dir === 0 ? x0 : x0 + cabLen;
      const cargo = () => {
        iso.box({ x: boxX, y: y0, z: 3, w: v.len - cabLen, d: v.wid, h: v.h }, v.body);
        iso.onFace({ x: boxX, y: y0, z: 3, w: v.len - cabLen, d: v.wid, h: v.h }, 'L', (t, fw, fh) => {
          t.fillStyle = v.top;
          t.fillRect(0, fh * 0.45, fw, fh * 0.2);
          drawProp(t, 'heart', fw / 2, fh * 0.3, 8);
        });
      };
      const cab = () => {
        iso.box({ x: front, y: y0 + 0.04, z: 3, w: cabLen, d: v.wid - 0.08, h: v.h * 0.7 }, v.top);
        iso.onFace({ x: front, y: y0 + 0.04, z: 3, w: cabLen, d: v.wid - 0.08, h: v.h * 0.7 }, 'R', (t, fw) => {
          t.fillStyle = '#8fd3f4';
          t.fillRect(2, 2, fw - 4, 5);
        });
      };
      // draw the part further from the viewer first
      if (dir === 0) {
        cargo();
        cab();
      } else {
        cab();
        cargo();
      }
    } else {
      iso.box({ x: x0, y: y0, z: 3, w: v.len, d: v.wid, h: v.h * (kind === 'bus' ? 1 : 0.55) }, v.body);
      if (kind === 'bus') {
        iso.onFace({ x: x0, y: y0, z: 3, w: v.len, d: v.wid, h: v.h }, 'L', (t, fw, fh) => {
          t.fillStyle = v.top;
          t.fillRect(0, fh - 5, fw, 2);
          for (let u = 4; u < fw - 6; u += 10) {
            t.fillStyle = '#8fd3f4';
            t.fillRect(u, 3, 7, 6);
          }
        });
        iso.onFace({ x: x0, y: y0, z: 3, w: v.len, d: v.wid, h: v.h }, 'R', (t, fw) => {
          t.fillStyle = '#8fd3f4';
          t.fillRect(2, 2, fw - 4, 7);
        });
      } else {
        const cab = { x: x0 + v.len * 0.25, y: y0 + 0.05, z: 3 + v.h * 0.55, w: v.len * 0.5, d: v.wid - 0.1, h: v.h * 0.45 };
        iso.box(cab, { top: v.top, left: '#8fd3f4', right: shade('#8fd3f4', -0.25) });
      }
    }
  });
}

export const VEHICLE_KINDS: VehicleKind[] = ['van', 'bus', 'car1', 'car2', 'car3'];
