import { applyAction, type Action, type ActionResult, type GameState, type SimEvent } from '../src/sim';

export const T0 = Date.UTC(2026, 9, 19, 12, 0, 0);
export const MIN = 60_000;
export const HOUR = 60 * MIN;

export function act(s: GameState, a: Action, now: number): GameState {
  const r = applyAction(s, a, now);
  if (!r.ok) throw new Error(`action ${a.t} failed: ${r.error} ${r.detail ?? ''}`);
  return r.state;
}

export function actE(s: GameState, a: Action, now: number): { state: GameState; events: SimEvent[] } {
  const r = applyAction(s, a, now);
  if (!r.ok) throw new Error(`action ${a.t} failed: ${r.error} ${r.detail ?? ''}`);
  return { state: r.state, events: r.events };
}

export function tryAct(s: GameState, a: Action, now: number): ActionResult {
  return applyAction(s, a, now);
}

export function findObj(s: GameState, item: string, pred: (o: GameState['objects'][string]) => boolean = () => true) {
  const o = Object.values(s.objects).find((x) => x.item === item && pred(x));
  if (!o) throw new Error(`no ${item}`);
  return o;
}

export function lastId(s: GameState): number {
  return s.nextId - 1;
}
