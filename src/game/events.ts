// Data-driven seasonal events (src/data/events.json): each event has a date
// window and can add themed items, goals and a collection while it runs.
import eventsJson from '../data/events.json';
import { buildContent, setContent, setEventResolver } from '../sim';
import type { CollectionDef, GoalDef, ItemDef } from '../sim/types';

export interface EventDef {
  id: string;
  /** Recurring window as MM-DD (inclusive), e.g. "10-01" .. "11-15". */
  from: string;
  to: string;
  items?: ItemDef[];
  goals?: GoalDef[];
  collection?: CollectionDef;
}

const EVENTS = (eventsJson as unknown as { events: EventDef[] }).events;

/** Every seasonal event id (each event's collection uses the same id). */
export const EVENT_IDS = EVENTS.map((e) => e.id);

function mmdd(now: number): string {
  const d = new Date(now);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function activeEvents(now: number): EventDef[] {
  const today = mmdd(now);
  return EVENTS.filter((e) => (e.from <= e.to ? today >= e.from && today <= e.to : today >= e.from || today <= e.to));
}

/** Registers event content so the simulation and build menu can use it. */
export function setupEvents(now = Date.now()): EventDef[] {
  // Event items, goals and collections are always known to the simulation (so
  // saves containing them stay valid); only their availability is date-gated.
  const items: ItemDef[] = [];
  const goals: GoalDef[] = [];
  const collections: CollectionDef[] = [];
  for (const e of EVENTS) {
    const live = activeEvents(now).includes(e);
    for (const it of e.items ?? []) items.push({ ...it, category: 'events', hidden: it.hidden || !live });
    goals.push(...(e.goals ?? []).map((g) => ({ ...g, event: e.id })));
    if (e.collection) collections.push(e.collection);
  }
  setContent(buildContent({ items, goals, collections }));
  setEventResolver((t) => activeEvents(t).map((e) => e.id));
  return activeEvents(now);
}
