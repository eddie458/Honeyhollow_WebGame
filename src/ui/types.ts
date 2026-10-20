// The slice of the game controller that UI modules use (avoids import cycles).
import type { GameAudio } from '../audio/audio';
import type { Prefs } from '../save/storage';
import type { Action, GameState } from '../sim/types';
import type { WorldIndex } from '../sim/world';

export type Tool = 'move' | 'rotate' | 'store' | 'sell';

export interface Neighbor {
  /** 'npc:pip' or 'user:12' */
  key: string;
  name: string;
  town: string;
  avatar: string;
  level: number;
  npc: boolean;
  helpsLeft: number;
  canGift: boolean;
}

export interface Ctrl {
  readonly state: GameState;
  readonly index: WorldIndex;
  readonly prefs: Prefs;
  readonly audio: GameAudio;
  readonly visiting: boolean;
  now(): number;
  dispatch(a: Action, opts?: { quiet?: boolean; objId?: number }): boolean;
  startPlacing(item: string, fromInventory?: boolean): void;
  setTool(tool: Tool | null): void;
  cancelMode(): void;
  rotateGhost(): void;
  savePrefs(): void;
  applyPrefs(): void;
  saveNow(): void;
  openBuild(cat?: string, highlight?: string): void;
  openGoal(id: string): void;
  openCollections(): void;
  openInventory(): void;
  openSettings(): void;
  openDaily(): void;
  openGifts(): void;
  openNeighbors(): void;
  openAccount(): void;
  startExpand(): void;
  visit(key: string): void;
  endVisit(): void;
  neighbors(): Neighbor[];
  zoom(f: number): void;
  hudTarget(kind: string): Element | null;
  exportSave(): void;
  importSave(): void;
  resetGame(): void;
  showHint(target: string | null): void;
  online(): boolean;
  /** Posts a job request so friends can staff a building. */
  requestJob(objectId: number, item: string): void;
  /** Display name for a helper or gift sender ('npc:pip', 'user:12'). */
  whoName(from: string): string;
  /** Portrait icon for a helper or gift sender. */
  whoIcon(from: string): string;
}
