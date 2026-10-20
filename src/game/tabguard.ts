// One city, one tab. Every tab saves the same browser save, so two open tabs
// would keep overwriting each other's progress. When the game starts it
// claims the save; any other open tab hears that and goes to sleep (it stops
// saving and offers to take over by reloading the latest save).

export function guardTabs(onSleep: () => void): void {
  if (typeof BroadcastChannel !== 'function') return;
  const channel = new BroadcastChannel('honeyhollow-tabs');
  const me = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  channel.onmessage = (e: MessageEvent<{ claim?: string }>) => {
    if (!e.data?.claim || e.data.claim === me) return;
    channel.close();
    onSleep();
  };
  channel.postMessage({ claim: me });
}
