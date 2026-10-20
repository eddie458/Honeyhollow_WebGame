// Typed, indexed access to the JSON content files. Everything the game knows
// about buildings, crops, goals, etc. comes from src/data/*.json.
import balanceJson from '../data/balance.json';
import itemsJson from '../data/items.json';
import goalsJson from '../data/goals.json';
import collectionsJson from '../data/collections.json';
import levelsJson from '../data/levels.json';
import shippingJson from '../data/shipping.json';
import npcsJson from '../data/npcs.json';
import achievementsJson from '../data/achievements.json';
import type {
  AchievementDef,
  BoostDef,
  CollectionDef,
  CropDef,
  GoalDef,
  ItemDef,
  LevelDef,
  Reward,
  ShipContractDef,
  TrainRouteDef,
} from './types';

export type Balance = typeof balanceJson;

export interface Content {
  balance: Balance;
  items: Record<string, ItemDef>;
  itemList: ItemDef[];
  crops: Record<string, CropDef>;
  cropList: CropDef[];
  goals: Record<string, GoalDef>;
  goalList: GoalDef[];
  collections: Record<string, CollectionDef>;
  collectionList: CollectionDef[];
  /** collectible id -> collection id */
  collectibleSet: Record<string, string>;
  levels: LevelDef[];
  parts: string[];
  contracts: Record<string, ShipContractDef>;
  contractList: ShipContractDef[];
  routes: Record<string, TrainRouteDef>;
  routeList: TrainRouteDef[];
  boosts: Record<string, BoostDef>;
  npcs: NpcDef[];
  /** Long-term badges in three tiers, and the reward for reaching each tier. */
  achievements: AchievementDef[];
  achievementRewards: Reward[];
}

export interface NpcDef {
  id: string;
  town: string;
  level: number;
  avatar: string;
  theme: string;
  seed: number;
  /** Crops grown in this town. */
  crops: string[];
  /** Road piece origins. */
  roads: [number, number][];
  /** Finished objects: [item, x, y]. */
  objects: [string, number, number][];
  /** Building sites still under construction: [item, x, y]. */
  sites: [string, number, number][];
}

function index<T extends { id: string }>(list: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const x of list) out[x.id] = x;
  return out;
}

export function buildContent(extra?: { items?: ItemDef[]; goals?: GoalDef[]; collections?: CollectionDef[] }): Content {
  const itemList = [...(itemsJson.items as ItemDef[]), ...(extra?.items ?? [])];
  const cropList = itemsJson.crops as CropDef[];
  const goalList = [...(goalsJson.goals as GoalDef[]), ...(extra?.goals ?? [])].sort((a, b) => a.order - b.order);
  const collectionList = [...(collectionsJson.collections as CollectionDef[]), ...(extra?.collections ?? [])];
  const collectibleSet: Record<string, string> = {};
  for (const c of collectionList) for (const i of c.items) collectibleSet[i] = c.id;
  const contractList = shippingJson.contracts as ShipContractDef[];
  const routeList = shippingJson.routes as TrainRouteDef[];
  return {
    balance: balanceJson,
    items: index(itemList),
    itemList,
    crops: index(cropList),
    cropList,
    goals: index(goalList),
    goalList,
    collections: index(collectionList),
    collectionList,
    collectibleSet,
    levels: (levelsJson.levels as LevelDef[]).slice().sort((a, b) => a.level - b.level),
    parts: itemsJson.parts,
    contracts: index(contractList),
    contractList,
    routes: index(routeList),
    routeList,
    boosts: index(shippingJson.boosts as BoostDef[]),
    npcs: npcsJson.npcs as unknown as NpcDef[],
    achievements: achievementsJson.achievements as AchievementDef[],
    achievementRewards: achievementsJson.rewards as Reward[],
  };
}

let current: Content = buildContent();

/** The active content set (seasonal events may extend it at startup). */
export function content(): Content {
  return current;
}

export function setContent(c: Content): void {
  current = c;
}

export function item(id: string): ItemDef {
  const def = current.items[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}

export function maybeItem(id: string): ItemDef | undefined {
  return current.items[id];
}
