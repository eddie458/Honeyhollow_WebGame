// "While you were away" summary: what finished between two states of the same
// city. Shown after loading a save (and by the dev-only time skip).
import { cropStage, energyCap, maybeItem, type GameState } from '../sim';
import { t } from '../ui/i18n';

export function awaySummary(before: GameState, after: GameState, away = after.now - before.now): string[] {
  if (away < 3 * 60_000) return [];
  const lines: string[] = [];
  let crops = 0;
  let rent = 0;
  let shops = 0;
  for (const k in after.objects) {
    const a = after.objects[k]!;
    const b = before.objects[k];
    if (!b) continue;
    const def = maybeItem(a.item);
    if (def?.kind === 'plot' && a.crop && cropStage(after, a, after.now) === 'ripe' && cropStage(before, b, before.now) !== 'ripe') crops++;
    if (def?.kind === 'house' && a.built && (a.readyAt ?? 0) <= after.now && (b.readyAt ?? 0) > before.now) rent++;
    if (a.shop?.state === 'soldout' && b.shop?.state === 'open') shops++;
  }
  const count = (key: string, n: number) => lines.push(t(n === 1 ? `${key}.one` : key, { n }));
  if (crops) count('msg.awayCrops', crops);
  if (rent) count('msg.awayRent', rent);
  if (shops) count('msg.awayShops', shops);
  const gained = Math.min(after.energy, energyCap(after.level)) - before.energy;
  if (gained > 0 && !after.settings.relaxed) lines.push(t('msg.awayEnergy', { n: gained }));
  return lines;
}
