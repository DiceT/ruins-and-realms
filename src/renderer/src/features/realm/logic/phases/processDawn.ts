import { RealmState, RealmWellnessLevel, getWellnessStatus, FoodStatus } from '../../types/realmTypes';
import { calculateFoodStatus } from '../../logic/economy/foodCalculator';

export interface DawnResult {
  newWellness: RealmWellnessLevel;
  populationChange: number; // +1, 0, or -1
  foodStatus: FoodStatus;
  log: string[];
}

/**
 * PHASE 1: DAWN — Status Checks
 * - Food Status (Demand vs Supply)
 * - Auto-Wellness adjustment
 * - Population Growth/Decline at thresholds
 * - Threat Damage (placeholder)
 */
export function processDawn(state: RealmState): DawnResult {
  const log: string[] = [];
  let newWellness = state.wellness;
  let populationChange = 0;

  log.push(`Dawn of Turn ${state.date.turn}. The realm stirs.`);

  // 1. Food Check
  const foodResult = calculateFoodStatus(state.population, state.buildings);
  let newFoodStatus = foodResult.status;

  if (foodResult.status === FoodStatus.STARVING) {
    log.push(`STARVATION! Food Demand (${foodResult.demand}) exceeds Supply (${foodResult.supply}).`);
    // Penalty: -1 Wellness
    newWellness = Math.max(-4, newWellness - 1) as RealmWellnessLevel;
  } else if (foodResult.status === FoodStatus.SURPLUS) {
    log.push(`Surplus harvest! Supply (${foodResult.supply}) exceeds Demand (${foodResult.demand}).`);
    // Bonus: Small chance for wellness? Or just log.
  } else {
    log.push(`Food supply stable (${foodResult.supply}/${foodResult.demand}).`);
  }

  // 2. Wellness Check
  const status = getWellnessStatus(newWellness);
  
  // 3. Population Growth/Decline Logic
  // At +4 (EUPHORIC), pop grows
  // At -4 (REBELLING), pop declines
  if (newWellness >= 4) {
    if (state.population.total < 10) { // Soft cap for testing
      populationChange = 1;
      log.push('The people are euphoric! A new family settles in the realm.');
    }
  } else if (newWellness <= -4) {
    if (state.population.total > 1) {
      populationChange = -1;
      log.push('Rebellion and despair! Citizens flee the realm.');
    }
  }

  // 4. Threat Damage (Stub)
  // TODO: Check threat level and apply damage to random building

  return {
    newWellness,
    populationChange,
    foodStatus: newFoodStatus,
    log
  };
}
