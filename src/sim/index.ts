// Public surface of the pure simulation.
export * from './types';
export { content, setContent, buildContent, item, maybeItem } from './content';
export type { Content, NpcDef, Balance } from './content';
export { applyAction, advance, cloneState, dayKey, cleanName, bonusStage, expansionCost, dailyAvailable, dailyNextDay, unlockProblem, shipReady, trainReady, helpApplies, bestHelp, sanitizeReward, franchiseCost } from './actions';
export { createNewGame, emptyState } from './newgame';
export { readSave, wrapSave, migrateState, saveVersion, SaveError, SAVE_FORMAT } from './migrate';
export type { SaveFile } from './migrate';
export * from './economy';
export * from './world';
export { energyNextIn, volunteerNextIn, currentShopRate } from './advance';
export { taskValue, taskDone, sortedActiveGoals, haveCount, setEventResolver, activeEventIds, achievementValue } from './goals';
export { isCollectionComplete } from './rewards';
export { hash2, Rng } from './rng';
export { buildNpcTown } from './npcTowns';
