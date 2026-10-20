// Hover tooltips: every object explains its state (countdowns, served
// counters, bonuses) - the "every interactive object shows its state" rule.
import { shipReady } from '../sim/actions';
import { content, maybeItem } from '../sim/content';
import { cropRemaining, cropStage, cropWitherIn, decoBonus, houseRent, shopGoods, shopPayout } from '../sim/economy';
import { rectOf, type WorldIndex } from '../sim/world';
import type { GameState, WorldObject } from '../sim/types';
import { duration, itemName, t } from './i18n';

export type TipLine = string | { bar: number };

export function objectTip(s: GameState, index: WorldIndex, o: WorldObject, now: number, visiting: boolean): TipLine[] {
  const def = maybeItem(o.item);
  if (!def) return [];
  const lines: TipLine[] = [o.shop?.name || itemName(def.id)];
  const total = def.clicks ?? 0;
  if (!o.built && total > 0) {
    if (o.clicks < total) {
      lines.push(t('tip.construction', { done: o.clicks, total }));
      lines.push({ bar: o.clicks / total });
      if (!visiting) lines.push(t('tip.clickToBuild'));
    } else if (def.jobs) {
      const filled = o.staff?.length ?? 0;
      lines.push(filled < def.jobs ? t('tip.needsStaff', { filled, jobs: def.jobs }) : t('tip.readyToFinish'));
      lines.push({ bar: filled / def.jobs });
    }
    return lines;
  }
  if (def.needsRoad && !index.roadAccess(rectOf(o))) lines.push(t('tip.noRoad'));
  switch (def.kind) {
    case 'house': {
      const left = Math.max(0, ((o.readyAt ?? 0) - now) / 1000);
      lines.push(t('tip.residents', { pop: def.pop ?? 0 }));
      if (left <= 0) lines.push(t('tip.rentReady'));
      else {
        lines.push(t('tip.rentIn', { time: duration(left) }));
        lines.push({ bar: 1 - left / (def.rentTime ?? 1) });
      }
      lines.push(`${t('tip.payout', { coins: houseRent(s, o, def, now) })}`);
      const b = decoBonus(s, o);
      if (b > 0) lines.push(t('tip.bonus', { pct: b }));
      break;
    }
    case 'business': {
      const sh = o.shop;
      if (!sh) break;
      const cap = shopGoods(o, def);
      if (sh.state === 'opening') lines.push(t('tip.opening', { goods: cap }));
      else if (sh.state === 'empty') lines.push(t('tip.needsGoods', { goods: cap }));
      else if (sh.state === 'soldout') lines.push(t('tip.soldOut'));
      if (sh.state === 'open' || sh.state === 'soldout') {
        lines.push(t('tip.served', { served: Math.floor(sh.served), total: cap }));
        lines.push({ bar: sh.served / cap });
      }
      lines.push(t('tip.payout', { coins: shopPayout(s, o, def, now) }));
      const b = decoBonus(s, o);
      if (b > 0) lines.push(t('tip.bonus', { pct: b }));
      break;
    }
    case 'plot': {
      const stage = cropStage(s, o, now);
      if (!o.crop || !stage) {
        lines.push(t('tip.emptyPlot'));
        break;
      }
      const crop = content().crops[o.crop.id]!;
      const name = t(`crop.${crop.id}`);
      if (stage === 'ripe') {
        lines.push(t('tip.ripe', { crop: name }));
        const w = cropWitherIn(s, o, crop, now);
        if (Number.isFinite(w)) lines.push(t('tip.witherIn', { time: duration(w) }));
      } else if (stage === 'withered') {
        lines.push(t('tip.withered'));
      } else {
        const left = cropRemaining(o, crop, now);
        lines.push(t('tip.growing', { crop: name, time: duration(left) }));
        lines.push({ bar: 1 - left / crop.time });
      }
      break;
    }
    case 'storage':
      lines.push(t('tip.storage', { goods: def.storage ?? 0 }));
      break;
    case 'decoration':
      lines.push(t('build.bonus', { pct: def.bonus ?? 0 }));
      break;
    case 'pier': {
      const ships = o.ships ?? [];
      ships.forEach((sh, i) => {
        if (!sh) lines.push(t('tip.dockFree', { n: i + 1 }));
        else if (shipReady(o, i, now)) lines.push(t('tip.shipBack', { n: i + 1 }));
        else {
          const c = content().contracts[sh.contract];
          if (c) lines.push(t('tip.shipAway', { n: i + 1, time: duration((sh.startedAt + c.time * 1000 - now) / 1000) }));
        }
      });
      break;
    }
    case 'station': {
      if (s.level < content().balance.train.unlockLevel) lines.push(t('tip.stationLocked', { level: content().balance.train.unlockLevel }));
      else if (!s.train) lines.push(t('tip.stationIdle'));
      else {
        const r = content().routes[s.train.route];
        const left = r ? (s.train.startedAt + r.time * 1000 - now) / 1000 : 0;
        lines.push(left <= 0 ? t('tip.trainBack') : t('tip.trainAway', { time: duration(left) }));
      }
      break;
    }
    case 'wonder': {
      const left = Math.max(0, ((o.boostReadyAt ?? 0) - now) / 1000);
      lines.push(left <= 0 ? t('tip.wonderReady') : t('tip.wonderRecharge', { time: duration(left) }));
      break;
    }
    default:
      break;
  }
  if (def.cap) lines.push(t('tip.capAdds', { cap: def.cap }));
  if (def.profit && def.profitTime && def.kind !== 'house') {
    const left = Math.max(0, ((o.readyAt ?? 0) - now) / 1000);
    lines.push(left <= 0 ? t('tip.profitReady') : t('tip.profitIn', { time: duration(left) }));
  }
  if (o.helpedAt && now - o.helpedAt < 3600_000) lines.push(t('tip.helped'));
  return lines;
}
