// Time of day: a sky colour multiplied into every world sprite, plus how dark
// it is (0..1) for lit windows, lamps and headlights. It follows the player's
// clock, runs a fast cycle, or stays fixed (the "Day and night" setting).
// Pure functions of the time, so they can be tested.

export type DayNightMode = 'clock' | 'cycle' | 'day' | 'night';
export const DAY_NIGHT_MODES: readonly DayNightMode[] = ['clock', 'cycle', 'day', 'night'];

export interface Daylight {
  /** 0xRRGGBB multiplied into world sprites (0xffffff = untouched). */
  tint: number;
  /** 0 by day, 1 at night: brightness of windows, lamps and headlights. */
  night: number;
  /** Hour of the day shown (0 to 24). */
  hour: number;
}

/** A full day and night take this many real minutes in the fast cycle. */
export const CYCLE_MINUTES = 24;

const NIGHT = 0x6a78c0;

// [hour, sky tint, night level]; the colour eases between neighbours.
const KEYS: readonly [number, number, number][] = [
  [0, NIGHT, 1],
  [5, NIGHT, 1],
  [6, 0xd6a6b6, 0.55],
  [7, 0xffeedd, 0.08],
  [8, 0xffffff, 0],
  [17, 0xffffff, 0],
  [18.5, 0xffe2ba, 0],
  [19.5, 0xe0a08c, 0.45],
  [20.5, NIGHT, 1],
  [24, NIGHT, 1],
];

/** The hour to show for a mode. `tzMinutes` is Date#getTimezoneOffset(). */
export function hourAt(mode: DayNightMode, now: number, tzMinutes: number): number {
  switch (mode) {
    case 'day':
      return 12;
    case 'night':
      return 23;
    case 'cycle':
      // one game hour per real minute, starting the epoch at 7 in the morning
      return ((now / 60_000) * (24 / CYCLE_MINUTES) + 7) % 24;
    default: {
      const local = now - tzMinutes * 60_000;
      return (((local / 3_600_000) % 24) + 24) % 24;
    }
  }
}

export function daylightAt(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]![0] <= h) i++;
  const [h0, c0, n0] = KEYS[i]!;
  const [h1, c1, n1] = KEYS[i + 1]!;
  const t = h1 > h0 ? smooth((h - h0) / (h1 - h0)) : 0;
  return { tint: mixColor(c0, c1, t), night: n0 + (n1 - n0) * t, hour: h };
}

export function daylight(mode: DayNightMode, now: number, tzMinutes: number): Daylight {
  return daylightAt(hourAt(mode, now, tzMinutes));
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Multiplies two 0xRRGGBB colours channel by channel (like a multiply tint). */
export function mulColor(a: number, b: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s;
  return ch(16) | ch(8) | ch(0);
}
