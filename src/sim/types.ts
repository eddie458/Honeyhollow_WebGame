// Core simulation types. This module (and everything in src/sim) is pure
// TypeScript with no DOM/Phaser dependencies so it can be unit-tested and
// re-run anywhere.

// ---------------------------------------------------------------- content --

export type ItemKind =
  | 'house'
  | 'business'
  | 'community'
  | 'decoration'
  | 'road'
  | 'sidewalk'
  | 'plot'
  | 'storage'
  | 'hotel'
  | 'pier'
  | 'station'
  | 'wonder'
  | 'landmark'
  | 'emptyLot'
  | 'hq';

export interface Unlock {
  level?: number;
  population?: number;
  goal?: string;
  neighbors?: number;
}

export interface UpgradeDef {
  /** Coins needed for this upgrade step. */
  coins: number;
  /** Building parts needed (part id -> count). */
  parts?: Record<string, number>;
  /** Minimum player level. */
  level?: number;
  /** Multiplier applied to payout/rent/goods/cap at this level. */
  mult: number;
  /** Extra population (houses) or cap (community) granted at this level. */
  extra?: number;
}

export interface ItemDef {
  id: string;
  kind: ItemKind;
  /** Build-menu tab. */
  category: string;
  /** Footprint in tiles [x-extent, y-extent] at rotation 0. */
  size: [number, number];
  price: number;
  /** Build-menu sort order. */
  sort?: number;
  unlock?: Unlock;
  /** Construction clicks (1 energy each). 0/undefined = placed instantly. */
  clicks?: number;
  /** XP given once when bought. */
  xp?: number;
  // houses
  pop?: number;
  rent?: number;
  rentTime?: number;
  // businesses
  goods?: number;
  payout?: number;
  // community / landmarks
  cap?: number;
  jobs?: number;
  profit?: number;
  profitTime?: number;
  // decorations
  bonus?: number;
  themeBonus?: number;
  radius?: number;
  // shared
  theme?: string;
  storage?: number;
  tourists?: number;
  /** Collection that can drop from this item. */
  collection?: string;
  needsRoad?: boolean;
  noSell?: boolean;
  noStore?: boolean;
  noMove?: boolean;
  noRotate?: boolean;
  limit?: number;
  /** Not sold in the build menu (rewards / fixed objects only). */
  hidden?: boolean;
  upgrades?: UpgradeDef[];
  /** Pier: boat slots per level. */
  slots?: number[];
  /** Wonder boost id. */
  boost?: string;
  /** Must be built on the shore (the row in front of it is sea). */
  coast?: boolean;
  /** Wonder/landmark build parts required after the frame is built. */
  parts?: Record<string, number>;
  /** Sprite key in the asset manifest (defaults to `item.<id>`). */
  art?: string;
}

export interface CropDef {
  id: string;
  seed: number;
  /** Grow time in seconds. */
  time: number;
  goods: number;
  xp: number;
  level: number;
  collection?: string;
}

export interface Reward {
  coins?: number;
  xp?: number;
  energy?: number;
  goods?: number;
  volunteers?: number;
  permits?: number;
  reputation?: number;
  /** Building parts / keys: id -> count */
  parts?: Record<string, number>;
  /** Items added to inventory: id -> count */
  items?: Record<string, number>;
  /** Collectibles: id -> count */
  collectibles?: Record<string, number>;
}

export type TaskType =
  /** Counter delta since the goal became active, e.g. key "harvest" or "built:bakery". */
  | 'stat'
  /** Own N finished objects of an item id or kind:<kind>. */
  | 'have'
  | 'population'
  | 'level'
  | 'popCap';

export interface TaskDef {
  type: TaskType;
  key?: string;
  count: number;
  /** Optional i18n key for a custom description. */
  text?: string;
  /** UI hint target, e.g. "build:bakery", "object:cottage", "ui:build". */
  hint?: string;
}

export interface GoalDef {
  id: string;
  char: string;
  order: number;
  requires?: string[];
  level?: number;
  tutorial?: boolean;
  /** Seasonal event id this goal belongs to. */
  event?: string;
  tasks: TaskDef[];
  reward: Reward;
}

/** A long-term badge: a stat counter (or the population) passing each tier's mark. */
export interface AchievementDef {
  id: string;
  stat?: string;
  type?: 'population';
  /** Marks for bronze, silver and gold. */
  tiers: number[];
  icon: string;
}

export interface CollectionDef {
  id: string;
  items: string[];
  reward: Reward;
}

export interface LevelDef {
  level: number;
  xp: number;
  reward?: Reward;
}

export interface ShipContractDef {
  id: string;
  coins: number;
  goods: number;
  time: number;
  level?: number;
  neighbors?: number;
}

export interface TrainRouteDef {
  id: string;
  /** 'buy' = pay coins, receive goods. 'sell' = pay goods, receive coins. */
  type: 'buy' | 'sell';
  cost: number;
  base: number;
  perStop: number;
  stops: number;
  time: number;
  level?: number;
}

export interface BoostDef {
  id: string;
  duration: number;
  cooldown: number;
  energy: number;
  /** Keys that recharge the wonder early. */
  keys: number;
  cropGoods?: number;
  shopSpeed?: number;
  payout?: number;
  rent?: number;
}

// ------------------------------------------------------------------ state --

export type Rot = 0 | 1;

export type ShopState = 'opening' | 'empty' | 'open' | 'soldout';

export interface ShopData {
  state: ShopState;
  /** Customers served so far (fractional while selling). */
  served: number;
  name?: string;
  /** Times collected (business mastery). */
  collects?: number;
}

export interface CropData {
  id: string;
  plantedAt: number;
  /** Seconds of growth added by watering help. */
  boost?: number;
  revived?: boolean;
}

export interface ShipSlot {
  contract: string;
  startedAt: number;
}

export interface WorldObject {
  id: number;
  item: string;
  x: number;
  y: number;
  rot: Rot;
  /** Construction clicks done. */
  clicks: number;
  /** Finished construction (and staffing). */
  built: boolean;
  /** Filled job slots: 'vol' (volunteer), 'npc:<id>', 'user:<id>'. */
  staff?: string[];
  /** Parts delivered for wonders/landmarks. */
  partsIn?: Record<string, number>;
  placedAt: number;
  builtAt?: number;
  /** Houses: when rent can next be collected. Community/hotel: profit. */
  readyAt?: number;
  shop?: ShopData;
  crop?: CropData | null;
  /** Upgrade level (1 = base). */
  level?: number;
  /** Pier boat slots. */
  ships?: (ShipSlot | null)[];
  /** Wonder: next time the boost can fire. */
  boostReadyAt?: number;
  /** Timestamp of the last neighbor help on this object (blue glow). */
  helpedAt?: number;
}

export interface GoalProgress {
  id: string;
  startedAt: number;
  /** Snapshot of stat counters when the goal became active. */
  base: Record<string, number>;
}

export interface Gift {
  id: string;
  from: string;
  /** Reward granted on accept. */
  reward: Reward;
  at: number;
}

export interface PendingHelp {
  id: string;
  from: string;
  objectId: number;
  action: HelpAction;
  at: number;
}

export type HelpAction = 'tourbus' | 'harvest' | 'water' | 'revive' | 'build' | 'clean';

export interface NpcState {
  /** Day key of the last visit (for help limits / visit bonus). */
  day: string;
  helps: number;
  /** Object ids helped today in that NPC town. */
  helped: number[];
  giftDay: string;
  /** Day key when this NPC last visited and helped the player. */
  visitDay: string;
  /** Buildings this NPC already staffed. */
  staffed: number[];
}

export interface TrainState {
  route: string;
  startedAt: number;
  stops: string[];
}

export interface ActiveBoost {
  id: string;
  until: number;
}

export interface GameSettings {
  /** Relaxed mode: no energy costs at all. */
  relaxed: boolean;
  /** Crops never wither. */
  noWither: boolean;
}

export interface GameState {
  /** Save-format version. */
  v: number;
  createdAt: number;
  /** Last time the simulation was advanced to (ms). */
  now: number;
  cityName: string;
  avatar: string;
  coins: number;
  xp: number;
  level: number;
  energy: number;
  /** Energy regen anchor (ms). */
  energyAt: number;
  goods: number;
  reputation: number;
  permits: number;
  volunteers: number;
  volunteersAt: number;
  parts: Record<string, number>;
  objects: Record<string, WorldObject>;
  nextId: number;
  /** Unlocked land lots as "lx,ly". */
  lots: string[];
  expansions: number;
  inventory: Record<string, number>;
  collectibles: Record<string, number>;
  collectionsDone: Record<string, number>;
  /** Harvest / collection counts per crop or business item id. */
  mastery: Record<string, number>;
  goals: { active: GoalProgress[]; done: string[] };
  stats: Record<string, number>;
  daily: { day: string; streak: number };
  boosts: ActiveBoost[];
  /** Doober pickups available to the bonus bar. */
  pickupBank: number;
  settings: GameSettings;
  rng: number;
  wishlist: string[];
  gifts: Gift[];
  helps: PendingHelp[];
  /** Recently applied help/gift ids (idempotency). */
  applied: string[];
  npc: Record<string, NpcState>;
  train: TrainState | null;
  achievements: Record<string, number>;
  /** Event id -> progress counters (seasonal events). */
  events: Record<string, Record<string, number>>;
  /** Visual: which tutorial intro messages have been shown. */
  flags: Record<string, boolean>;
}

// ---------------------------------------------------------------- actions --

export type Action =
  | { t: 'place'; item: string; x: number; y: number; rot: Rot; fromInventory?: boolean }
  | { t: 'build'; id: number }
  | { t: 'collect'; id: number }
  | { t: 'supply'; id: number }
  | { t: 'plant'; id: number; crop: string }
  | { t: 'harvest'; id: number }
  | { t: 'clearPlot'; id: number }
  | { t: 'move'; id: number; x: number; y: number; rot: Rot }
  | { t: 'rotate'; id: number }
  | { t: 'store'; id: number }
  | { t: 'sell'; id: number }
  | { t: 'staff'; id: number; source: string }
  | { t: 'finish'; id: number }
  | { t: 'claimDaily'; tz: number }
  | { t: 'redeem'; collection: string }
  | { t: 'bonus'; pickups: number }
  | { t: 'expand'; lx: number; ly: number }
  | { t: 'upgrade'; id: number }
  | { t: 'ship'; id: number; slot: number; contract: string }
  | { t: 'unload'; id: number; slot: number }
  | { t: 'train'; route: string; stops: string[] }
  | { t: 'trainCollect' }
  | { t: 'boost'; id: number }
  | { t: 'recharge'; id: number }
  | { t: 'deliverParts'; id: number }
  | { t: 'nameShop'; id: number; name: string }
  | { t: 'rename'; name: string }
  | { t: 'setAvatar'; avatar: string }
  | { t: 'settings'; relaxed?: boolean; noWither?: boolean }
  | { t: 'wishlist'; items: string[] }
  | { t: 'acceptGift'; id: string }
  | { t: 'acceptHelp'; id: string }
  | { t: 'declineHelp'; id: string }
  | { t: 'addGifts'; gifts: Gift[] }
  | { t: 'addHelps'; helps: PendingHelp[] }
  | { t: 'helpReward'; reward: Reward; npc?: string; objectId?: number; day?: string; key: string; at?: [number, number] }
  | { t: 'visitBonus'; npc: string; day: string }
  | { t: 'npcDaily'; day: string; helps?: boolean }
  | { t: 'franchisePay'; item: string }
  | { t: 'franchiseSupply'; goods: number; reward: Reward; key: string }
  | { t: 'flag'; key: string }
  | { t: 'grant'; reward: Reward; key: string };

export type ErrorCode =
  | 'coast'
  | 'noEnergy'
  | 'noCoins'
  | 'noGoods'
  | 'noVolunteers'
  | 'noPermits'
  | 'noParts'
  | 'blocked'
  | 'notOwned'
  | 'needsRoad'
  | 'locked'
  | 'popCap'
  | 'notFound'
  | 'notReady'
  | 'invalid'
  | 'limit'
  | 'storageFull'
  | 'alreadyDone'
  | 'busy';

// ----------------------------------------------------------------- events --

export type DropKind = 'coins' | 'xp' | 'energy' | 'goods' | 'collectible' | 'reputation' | 'volunteer' | 'permit' | 'part';

export interface Drop {
  kind: DropKind;
  amount: number;
  /** Collectible / part id. */
  id?: string;
  /** Goods crate shows produce (from farms). */
  produce?: string;
}

export type SimEvent =
  | { type: 'drops'; objId?: number; x: number; y: number; drops: Drop[] }
  | { type: 'levelUp'; level: number; reward: Reward }
  | { type: 'goalDone'; id: string }
  | { type: 'goalNew'; id: string }
  | { type: 'achievement'; id: string; tier: number }
  | { type: 'collectible'; id: string; collection: string }
  | { type: 'collectionReady'; id: string }
  | { type: 'moveIn'; objId: number; pop: number }
  | { type: 'built'; objId: number }
  | { type: 'needsStaff'; objId: number }
  | { type: 'shopOpened'; objId: number }
  | { type: 'storageFull'; lost: number }
  | { type: 'mastery'; item: string; stars: number }
  | { type: 'placed'; objId: number }
  | { type: 'removed'; objId: number }
  | { type: 'boost'; id: string; until: number }
  | { type: 'expanded'; lx: number; ly: number }
  | { type: 'message'; key: string; params?: Record<string, string | number> };

export type ActionResult =
  | { ok: true; state: GameState; events: SimEvent[] }
  | { ok: false; error: ErrorCode; detail?: string };
