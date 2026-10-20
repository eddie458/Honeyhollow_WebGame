// Smooth driving routes over 3x3 road pieces. A route is a chain of piece
// origins; the car keeps to the right-hand lane, rounds its corners and makes a
// proper U-turn at a dead end, so its position never jumps between lanes.
// Pure geometry in tile coordinates (no Phaser), so it can be tested.

export type Tile = [number, number];

/** Where a car is and which way it faces (tile space; heading is a unit vector). */
export interface RoutePoint {
  x: number;
  y: number;
  hx: number;
  hy: number;
}

/** Distance of the lane centre from the road centre (tiles). */
export const LANE = 0.55;
/** How far before and after a corner point the rounded turn starts and ends. */
const TURN = 0.75;
/** A U-turn loops this far past the dead-end piece's centre. */
const UTURN_AT = 0.3;
const HALF = 1.5;

interface Seg {
  len: number;
  /** Index of the node this segment drives towards. */
  node: number;
  at(u: number): RoutePoint;
}

type Vec = [number, number];

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
/** Offset to the right-hand lane for a heading. */
const right = (d: Vec): Vec => [-d[1] * LANE, d[0] * LANE];

function line(a: Vec, b: Vec, node: number): Seg | null {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-6) return null;
  const hx = (b[0] - a[0]) / len;
  const hy = (b[1] - a[1]) / len;
  return { len, node, at: (u) => ({ x: a[0] + hx * u, y: a[1] + hy * u, hx, hy }) };
}

/** Rounded 90 degree corner: quadratic curve from s through control q to e. */
function corner(s: Vec, q: Vec, e: Vec, node: number): Seg {
  let len = 0;
  let prev = s;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const p = bez(s, q, e, t);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return {
    len,
    node,
    at: (u) => {
      const t = Math.min(1, Math.max(0, u / len));
      const p = bez(s, q, e, t);
      const dx = 2 * (1 - t) * (q[0] - s[0]) + 2 * t * (e[0] - q[0]);
      const dy = 2 * (1 - t) * (q[1] - s[1]) + 2 * t * (e[1] - q[1]);
      const n = Math.hypot(dx, dy) || 1;
      return { x: p[0], y: p[1], hx: dx / n, hy: dy / n };
    },
  };
}

function bez(s: Vec, q: Vec, e: Vec, t: number): Vec {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * s[0] + b * q[0] + c * e[0], a * s[1] + b * q[1] + c * e[1]];
}

/** Half circle around m from the right lane to the left one, turning through heading d. */
function uturn(m: Vec, d: Vec, node: number): Seg {
  const r: Vec = [-d[1], d[0]];
  return {
    len: Math.PI * LANE,
    node,
    at: (u) => {
      const phi = u / LANE;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      return {
        x: m[0] + LANE * (c * r[0] + s * d[0]),
        y: m[1] + LANE * (c * r[1] + s * d[1]),
        hx: -s * r[0] + c * d[0],
        hy: -s * r[1] + c * d[1],
      };
    },
  };
}

export class Route {
  /** Piece origins, oldest first; `base` is the absolute index of nodes[0]. */
  private nodes: Tile[];
  private base = 0;
  private segs: Seg[] = [];
  /** Absolute index of the next node whose outgoing stretch is still unbuilt. */
  private next = 0;
  /** Where that stretch starts (the exit of the previous corner). */
  private from: Vec;
  private head = 0;
  private u = 0;
  private ended = false;

  /**
   * @param open more pieces will be pushed as the car drives (ambient cars);
   * a closed route ends in the lane at the centre of its last piece.
   */
  constructor(nodes: Tile[], private readonly open: boolean) {
    this.nodes = nodes.length ? nodes.map((n) => [n[0], n[1]] as Tile) : [[0, 0]];
    const d = this.dir(0) ?? ([1, 0] as Vec);
    this.from = add(this.center(0), right(d));
    this.build();
  }

  /** Adds the next piece to drive to (it must be a neighbour of the last one). */
  push(t: Tile): void {
    this.nodes.push([t[0], t[1]]);
    this.build();
  }

  /** The last piece known, and the one before it. */
  last(): { cur: Tile; prev: Tile | null } {
    const n = this.nodes.length;
    return { cur: this.nodes[n - 1]!, prev: n > 1 ? this.nodes[n - 2]! : null };
  }

  /** Pieces known beyond the one the car is driving towards. */
  ahead(): number {
    const seg = this.segs[this.head];
    const at = seg ? seg.node : this.next;
    return this.base + this.nodes.length - 1 - at;
  }

  /** The pieces still ahead of the car, including the one it is heading for. */
  upcoming(): Tile[] {
    const seg = this.segs[this.head];
    const at = (seg ? seg.node : this.next) - this.base;
    return this.nodes.slice(Math.max(0, at - 1));
  }

  /** True once a closed route is fully driven (or an open one ran out of pieces). */
  get finished(): boolean {
    return this.head >= this.segs.length;
  }

  /** Drives `d` tiles further along. */
  advance(d: number): void {
    this.u += d;
    while (this.head < this.segs.length && this.u >= this.segs[this.head]!.len) {
      this.u -= this.segs[this.head]!.len;
      this.head++;
    }
    if (this.head >= this.segs.length) this.u = 0;
    this.prune();
  }

  point(): RoutePoint {
    const seg = this.segs[Math.min(this.head, this.segs.length - 1)];
    if (!seg) {
      const d = this.dir(0) ?? ([1, 0] as Vec);
      return { x: this.from[0], y: this.from[1], hx: d[0], hy: d[1] };
    }
    return seg.at(this.head >= this.segs.length ? seg.len : this.u);
  }

  private node(abs: number): Tile | undefined {
    return this.nodes[abs - this.base];
  }

  private center(abs: number): Vec {
    const n = this.node(abs)!;
    return [n[0] + HALF, n[1] + HALF];
  }

  /** Unit heading from node `abs` to the next one. */
  private dir(abs: number): Vec | null {
    const a = this.node(abs);
    const b = this.node(abs + 1);
    if (!a || !b) return null;
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    if (dx === 0 && dy === 0) return null;
    return dx !== 0 ? [dx, 0] : [0, dy];
  }

  private build(): void {
    while (!this.ended) {
      const k = this.next;
      const dIn = this.dir(k);
      if (!dIn) {
        // nothing (or no move) after this piece: open routes wait for more
        if (!this.open) this.ended = true;
        return;
      }
      const j = k + 1;
      const dOut = this.dir(j);
      const cj = this.center(j);
      if (!dOut) {
        if (this.open) return; // wait until we know where the car turns next
        this.pushSeg(line(this.from, add(cj, right(dIn)), j));
        this.ended = true;
        return;
      }
      if (dOut[0] === dIn[0] && dOut[1] === dIn[1]) {
        // straight on: drive to this piece's centre, the lane carries on from there
        const mid = add(cj, right(dIn));
        this.pushSeg(line(this.from, mid, j));
        this.from = mid;
      } else if (dOut[0] === -dIn[0] && dOut[1] === -dIn[1]) {
        const m = add(cj, mul(dIn, UTURN_AT));
        this.pushSeg(line(this.from, add(m, right(dIn)), j));
        this.pushSeg(uturn(m, dIn, j));
        this.from = sub(m, right(dIn));
      } else {
        const q = add(add(cj, right(dIn)), right(dOut));
        const s = sub(q, mul(dIn, TURN));
        this.pushSeg(line(this.from, s, j));
        const e = add(q, mul(dOut, TURN));
        this.pushSeg(corner(s, q, e, j));
        this.from = e;
      }
      this.next = j;
    }
  }

  private pushSeg(s: Seg | null): void {
    if (s) this.segs.push(s);
  }

  /** Forgets driven stretches so endless ambient routes stay small. */
  private prune(): void {
    if (this.head < 24) return;
    const keepFrom = this.segs[this.head]?.node ?? this.next;
    this.segs.splice(0, this.head);
    this.head = 0;
    const drop = Math.max(0, keepFrom - 2 - this.base);
    if (drop > 0) {
      this.nodes.splice(0, drop);
      this.base += drop;
    }
  }
}
