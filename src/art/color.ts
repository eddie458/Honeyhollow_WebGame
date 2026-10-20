// Tiny color helpers for procedural art (hex <-> rgb, shade, mix).

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** amount > 0 lightens towards white, < 0 darkens towards black (range -1..1). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amount >= 0) return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  const k = 1 + amount;
  return rgbToHex(r * k, g * k, b * k);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hexToInt(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

/** Shared palette - bright, toy-like daylight. */
export const PAL = {
  lawn: '#7cc242',
  lawnDark: '#5fa632',
  lawnLight: '#94d35a',
  wild: '#6aae3c',
  asphalt: '#6b6e73',
  asphaltDark: '#5a5d62',
  lane: '#f4efe0',
  laneYellow: '#f2c94c',
  curb: '#d9d4c7',
  curbDark: '#b9b2a2',
  sidewalk: '#ddd6c6',
  brick: '#b5533c',
  cream: '#f3e3bf',
  water: '#3fa7d6',
  waterDeep: '#2f8cc0',
  sand: '#ecd9a0',
  soil: '#8a5a36',
  soilDark: '#6e4426',
  wood: '#a5703f',
  woodDark: '#7a4e2d',
  glass: '#8fd3f4',
  glassDark: '#5fb2dc',
  white: '#ffffff',
  outline: '#3b2a1e',
  roofRed: '#c8483c',
  roofTeal: '#3e8e8a',
  roofSlate: '#5b6b7a',
  roofHoney: '#e8a93a',
  coin: '#f6c033',
  xp: '#3b8fe0',
  energy: '#ffd23f',
  shadow: 'rgba(30, 40, 20, 0.22)',
};
