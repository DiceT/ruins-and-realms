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

  // 1. Food Check - 4-tier system per Addendum 006
  const foodResult = calculateFoodStatus(state.population, state.buildings);
  let newFoodStatus = foodResult.status;

  switch (foodResult.status) {
    case FoodStatus.STARVATION:
      log.push(`STARVATION! Food Demand (${foodResult.demand}) far exceeds Supply (${foodResult.supply}).`);
      // Penalty: -2 Wellness, population loss
      newWellness = Math.max(-4, newWellness - 2) as RealmWellnessLevel;
      if (state.population.total > 1) {
        populationChange = -1;
        log.push('A citizen has perished from hunger.');
      }
      break;
    
    case FoodStatus.SHORTAGE:
      log.push(`Food shortage! Supply (${foodResult.supply}) below Demand (${foodResult.demand}).`);
      // Penalty: -1 Wellness, no growth
      newWellness = Math.max(-4, newWellness - 1) as RealmWellnessLevel;
      break;
    
    case FoodStatus.FED:
      log.push(`Food supply stable (${foodResult.supply}/${foodResult.demand}).`);
      // Stable - no change
      break;
    
    case FoodStatus.SURPLUS:
      log.push(`Surplus harvest! Supply (${foodResult.supply}) exceeds Demand (${foodResult.demand}).`);
      // Bonus: +1 Wellness
      newWellness = Math.min(4, newWellness + 1) as RealmWellnessLevel;
      break;
  }

  // 2. Wellness Check
  const status = getWellnessStatus(newWellness);
  
  // 3. Population Growth/Decline Logic (only if not already changed by starvation)
  // At +4 (THRIVING), pop grows
  // At -4 (CRISIS), pop declines
  if (populationChange === 0) {
    if (newWellness >= 4) {
      if (state.population.total < 50) { // No arbitrary cap
        populationChange = 1;
        log.push('The people are thriving! A new family settles in the realm.');
      }
    } else if (newWellness <= -4) {
      if (state.population.total > 1) {
        populationChange = -1;
        log.push('Crisis and despair! Citizens flee the realm.');
      }
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
