import { RealmState } from '../../types/realmTypes';

export interface NightResult {
  nextTurn: number;
  log: string[];
}

/**
 * PHASE 5: NIGHT — Resolution
 * - Return workers to housing (reset assigned)
 * - Advance Turn Date
 */
export function processNight(state: RealmState): NightResult {
  const log: string[] = [];

  // 1. Reset Workers
  // In this design, workers return home at night. 
  // Next morning they might be auto-assigned or manually assigned.
  // For now, we just ensure the state reflects them being "available" (though the store setter might handle this).
  // The logic function here returns what *changed*, or we mutate a clone?
  // Our pattern so far returns a Result object, and the Store applies it.
  
  // 2. Advance Turn
  const nextTurn = state.date.turn + 1;
  log.push(`Night falls. The realm sleeps. Turn ${state.date.turn} ends.`);

  return {
    nextTurn,
    log
  };
}
