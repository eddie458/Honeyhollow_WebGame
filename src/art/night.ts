// Night layers for procedural sprites. A sprite with light sources (windows,
// lamps, lanterns) is drawn twice: once by day, then with `night.on` set, when
// lit windows glow and lamps shine. The sprite bank keeps the pixels that
// changed between the two passes as the sprite's ".lit" layer, so lights that
// are hidden behind something drawn in front of them stay hidden.
export const night = { on: false, lights: 0, seed: 0 };

/** Resets the light counter before each pass of a sprite. */
export function startSprite(key: string): void {
  night.lights = 0;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  night.seed = h >>> 0;
}

/**
 * Registers one light source and says whether to draw it switched on. Both
 * passes call this in the same order, so they agree on which windows are lit;
 * only the night pass ever gets `true`.
 */
export function nextLight(chance = 1): boolean {
  const i = night.lights++;
  if (!night.on) return false;
  const h = Math.imul(night.seed ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return h / 4294967296 < chance;
}

/** Device pixels per drawing unit at the current transform (resolution x any face skew). */
export function pixelScale(c: CanvasRenderingContext2D): number {
  const m = c.getTransform();
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}
