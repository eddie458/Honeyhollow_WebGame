// Developer tool: makes a city look as if `ms` more time had passed. Every
// timestamp in the state moves back by `ms`, so calling advance() afterwards
// fast-forwards energy, volunteers, crops, rent, shops, boats and the train
// exactly like real time away would. Whole days also move the day keys (daily
// bonus, neighbor visits and help limits) and the ids built from them, so a
// one-day skip starts a new day. Only the dev build imports this module.
//
// When a new timestamp field is added to GameState or WorldObject, shift it
// here too (tests/timeskip.test.ts compares a skip against really waiting).
import { cloneState } from './actions';
import type { GameState } from './types';

const DAY_MS = 86_400_000;
const DAY_KEY = /\d{4}-\d{2}-\d{2}/g;

/** Moves a "YYYY-MM-DD" day key back by `days`; anything else is returned unchanged. */
export function shiftDayKey(key: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m || days === 0) return key;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - days * DAY_MS;
  return new Date(at).toISOString().slice(0, 10);
}

/** Returns a copy of `state` aged by `ms` milliseconds (see the note above). */
export function shiftTime(state: GameState, ms: number): GameState {
  const s = cloneState(state);
  if (!(ms > 0) || !Number.isFinite(ms)) return s;
  s.createdAt -= ms;
  s.now -= ms;
  s.energyAt -= ms;
  s.volunteersAt -= ms;
  for (const b of s.boosts) b.until -= ms;
  for (const g of s.gifts) g.at -= ms;
  for (const h of s.helps) h.at -= ms;
  for (const g of s.goals.active) g.startedAt -= ms;
  if (s.train) s.train.startedAt -= ms;
  for (const k in s.objects) {
    const o = s.objects[k]!;
    o.placedAt -= ms;
    if (o.builtAt !== undefined) o.builtAt -= ms;
    if (o.readyAt !== undefined) o.readyAt -= ms;
    if (o.boostReadyAt !== undefined) o.boostReadyAt -= ms;
    if (o.helpedAt !== undefined) o.helpedAt -= ms;
    if (o.crop) o.crop.plantedAt -= ms;
    for (const sh of o.ships ?? []) if (sh) sh.startedAt -= ms;
  }
  const days = Math.floor(ms / DAY_MS);
  if (days > 0) {
    const inText = (text: string) => text.replace(DAY_KEY, (k) => shiftDayKey(k, days));
    s.daily.day = shiftDayKey(s.daily.day, days);
    for (const id in s.npc) {
      const n = s.npc[id]!;
      n.day = shiftDayKey(n.day, days);
      n.giftDay = shiftDayKey(n.giftDay, days);
      n.visitDay = shiftDayKey(n.visitDay, days);
    }
    // NPC gift/help ids and idempotency keys contain the day they were made.
    s.applied = s.applied.map(inText);
    for (const g of s.gifts) g.id = inText(g.id);
    for (const h of s.helps) h.id = inText(h.id);
  }
  return s;
}
