// Which seasonal events are live. The events module (src/game/events.ts)
// registers a resolver from the dated windows in events.json; the simulation
// asks it when activating event goals and when choosing collectible drops.

let eventResolver: (now: number) => string[] = () => [];

/** The events module registers which seasonal events are live at a time. */
export function setEventResolver(fn: (now: number) => string[]): void {
  eventResolver = fn;
}

export function activeEventIds(now: number): string[] {
  return eventResolver(now);
}

export function isEventActive(eventId: string | undefined, now: number): boolean {
  if (!eventId) return true;
  return activeEventIds(now).includes(eventId);
}
