import { describe, expect, it } from 'vitest';
import { CYCLE_MINUTES, daylight, daylightAt, hourAt, mixColor, mulColor } from '../src/render/daylight';
import { LANE, Route, type RoutePoint, type Tile } from '../src/render/route';

/** Drives a route in small steps and returns every point visited. */
function drive(route: Route, step = 0.02, limit = 5000): RoutePoint[] {
  const pts = [route.point()];
  for (let i = 0; i < limit && !route.finished; i++) {
    route.advance(step);
    pts.push(route.point());
  }
  return pts;
}

function maxJump(pts: RoutePoint[]): number {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m = Math.max(m, Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return m;
}

describe('car routes', () => {
  it('keep to the right-hand lane on a straight road', () => {
    const pts = drive(new Route([[0, 0], [3, 0], [6, 0]], false));
    expect(pts[0]).toMatchObject({ x: 1.5, y: 1.5 + LANE, hx: 1, hy: 0 });
    const end = pts[pts.length - 1]!;
    expect(end.x).toBeCloseTo(7.5);
    expect(end.y).toBeCloseTo(1.5 + LANE);
    expect(pts.every((p) => Math.abs(p.y - (1.5 + LANE)) < 1e-9)).toBe(true);
  });

  it('round corners without jumping between lanes', () => {
    for (const nodes of [
      [[0, 0], [3, 0], [3, 3], [6, 3]],
      [[0, 0], [3, 0], [3, -3], [6, -3]],
      [[6, 0], [3, 0], [3, 3], [0, 3]],
    ] as Tile[][]) {
      const pts = drive(new Route(nodes, false));
      expect(maxJump(pts)).toBeLessThan(0.05);
      // it ends in the lane of the last stretch
      const last = pts[pts.length - 1]!;
      const [a, b] = nodes.slice(-2) as [Tile, Tile];
      const dx = Math.sign(b[0] - a[0]);
      const dy = Math.sign(b[1] - a[1]);
      expect(last.x).toBeCloseTo(b[0] + 1.5 - dy * LANE);
      expect(last.y).toBeCloseTo(b[1] + 1.5 + dx * LANE);
    }
  });

  it('turns round at a dead end and drives back in the other lane', () => {
    const pts = drive(new Route([[0, 0], [3, 0], [0, 0]], false));
    expect(maxJump(pts)).toBeLessThan(0.05);
    const last = pts[pts.length - 1]!;
    expect(last.x).toBeCloseTo(1.5);
    expect(last.y).toBeCloseTo(1.5 - LANE);
    expect(last.hx).toBeCloseTo(-1);
    // the loop stays inside the dead-end piece
    expect(Math.max(...pts.map((p) => p.x))).toBeLessThan(6);
  });

  it('keeps going smoothly while pieces are added on the way (ambient cars)', () => {
    const route = new Route([[0, 0], [3, 0]], true);
    const lane: Tile[] = [[6, 0], [9, 0], [9, 3], [9, 6], [6, 6], [3, 6], [3, 3]];
    const pts: RoutePoint[] = [route.point()];
    let next = 0;
    for (let i = 0; i < 4000; i++) {
      while (route.ahead() < 3 && next < lane.length) route.push(lane[next++]!);
      if (route.finished) break;
      route.advance(0.02);
      pts.push(route.point());
    }
    expect(next).toBe(lane.length);
    expect(pts.length).toBeGreaterThan(500);
    expect(maxJump(pts)).toBeLessThan(0.05);
  });
});

describe('day and night', () => {
  it('is plain day at noon and dark blue at night', () => {
    expect(daylightAt(12)).toEqual({ tint: 0xffffff, night: 0, hour: 12 });
    const midnight = daylightAt(0);
    expect(midnight.night).toBe(1);
    expect(midnight.tint).toBe(daylightAt(23).tint);
    expect(midnight.tint & 0xff).toBeGreaterThan((midnight.tint >> 16) & 0xff); // more blue than red
  });

  it('eases through dusk and dawn', () => {
    const dusk = daylightAt(19.5);
    expect(dusk.night).toBeGreaterThan(0.3);
    expect(dusk.night).toBeLessThan(0.7);
    for (let h = 0; h < 24; h += 0.25) {
      const a = daylightAt(h);
      const b = daylightAt(h + 0.25);
      expect(Math.abs(a.night - b.night)).toBeLessThan(0.25);
    }
  });

  it('follows the clock, the fast cycle or a fixed hour', () => {
    const t = Date.UTC(2026, 9, 19, 21, 30);
    expect(hourAt('clock', t, 0)).toBeCloseTo(21.5);
    expect(hourAt('clock', t, 300)).toBeCloseTo(16.5); // UTC-5
    expect(hourAt('day', t, 0)).toBe(12);
    expect(daylight('night', t, 0).night).toBe(1);
    const h0 = hourAt('cycle', t, 0);
    const h1 = hourAt('cycle', t + (CYCLE_MINUTES / 24) * 60_000, 0);
    expect((h1 - h0 + 24) % 24).toBeCloseTo(1);
  });

  it('mixes and multiplies colours per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mulColor(0xffffff, 0x6a78c0)).toBe(0x6a78c0);
    expect(mulColor(0x808080, 0x808080)).toBe(0x404040);
  });
});
