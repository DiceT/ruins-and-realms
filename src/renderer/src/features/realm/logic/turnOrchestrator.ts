import { RealmState } from '../types/realmTypes';
import { TurnPhase } from '../types/turnTypes';
import { processDawn } from './phases/processDawn';
import { processMorning } from './phases/processMorning';
import { processDusk } from './phases/processDusk';
import { processNight } from './phases/processNight';

export interface TurnResult {
  newState: RealmState;
  logs: string[];
}

/**
 * ADVANCE TURN
 * Executes the sequence: Dusk (End of current day) -> Night -> Dawn (Start of next) -> Morning -> Midday
 */
export function processTurn(currentState: RealmState): TurnResult {
  const logs: string[] = [];
  
  // 1. DUSK (End of Day N)
  const dusk = processDusk(currentState);
  logs.push(...dusk.log);
  
  // 2. NIGHT
  // Create intermediate state for mutation flow or clone?
  // Let's shallow clone at each step or accumulate changes.
  let state = { ...currentState }; 
  // Note: Deep clone might be safer for nested objects like population/date, 
  // but for now we manually update specific fields.
  
  const night = processNight(state);
  logs.push(...night.log);
  
  // Apply Night changes
  state = {
    ...state,
    date: { ...state.date, turn: night.nextTurn },
    population: { // Reset workers
      ...state.population,
      assignedWorkers: 0,
      availableWorkers: state.population.total
    }
  };

  // 3. DAWN (Start of Day N+1)
  const dawn = processDawn(state);
  logs.push(...dawn.log);
  
  // Apply Dawn Results (including threat damage to buildings and title progression)
  state = {
    ...state,
    wellness: dawn.newWellness,
    population: {
      ...state.population,
      total: Math.max(0, state.population.total + dawn.populationChange),
      availableWorkers: Math.max(0, state.population.availableWorkers + dawn.populationChange)
    },
    foodStatus: dawn.foodStatus,
    buildings: dawn.updatedBuildings,  // Includes threat damage
    titles: dawn.newTitles,            // Title progression
    threat: dawn.newThreat             // Updated threat level
  };

  // 4. MORNING
  const morning = processMorning(state);
  logs.push(...morning.log);
  
  // Apply Morning Changes
  state = {
    ...state,
    rings: Math.max(0, state.rings + morning.netChange),
    buildings: morning.updatedBuildings, // Apply construction progress
    tax: morning.newTaxState,
    baronPatience: morning.newPatience,
    phase: TurnPhase.MIDDAY, // Hand back control to player
    actionPoints: {
      ...state.actionPoints,
      current: state.actionPoints.max // Reset AP for the new day
    }
  };

  return {
    newState: state,
    logs
  };
}
