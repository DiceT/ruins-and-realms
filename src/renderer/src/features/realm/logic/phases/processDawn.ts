import { RealmState, RealmWellnessLevel, getWellnessStatus, FoodStatus, BuildingInstance, TitleId } from '../../types/realmTypes';
import { calculateFoodStatus } from '../../logic/economy/foodCalculator';
import { applyThreatEffects, calculateTotalThreat, getThreatLevel } from '../../logic/threat/threatCalculator';
import { processTitleProgression } from '../../logic/titles/titleProgression';

export interface DawnResult {
  newWellness: RealmWellnessLevel;
  populationChange: number;
  foodStatus: FoodStatus;
  updatedBuildings: BuildingInstance[];
  newTitles: TitleId[];
  newThreat: number;
  log: string[];
}

/**
 * PHASE 1: DAWN — Status Checks
 * - Food Status (Demand vs Supply)
 * - Threat Effects (Wellness, Building Damage)
 * - Title Progression
 * - Population Growth/Decline at thresholds
 */
export function processDawn(state: RealmState): DawnResult {
  const log: string[] = [];
  let newWellness = state.wellness;
  let populationChange = 0;
  let updatedBuildings = [...state.buildings.map(b => ({ ...b }))];

  log.push(`Dawn of Turn ${state.date.turn}. The realm stirs.`);

  // 1. Food Check - 4-tier system per Addendum 006
  const foodResult = calculateFoodStatus(state.population, state.buildings);
  let newFoodStatus = foodResult.status;

  switch (foodResult.status) {
    case FoodStatus.STARVATION:
      log.push(`STARVATION! Food Demand (${foodResult.demand}) far exceeds Supply (${foodResult.supply}).`);
      newWellness = Math.max(-4, newWellness - 2) as RealmWellnessLevel;
      if (state.population.total > 1) {
        populationChange = -1;
        log.push('A citizen has perished from hunger.');
      }
      break;
    
    case FoodStatus.SHORTAGE:
      log.push(`Food shortage! Supply (${foodResult.supply}) below Demand (${foodResult.demand}).`);
      newWellness = Math.max(-4, newWellness - 1) as RealmWellnessLevel;
      break;
    
    case FoodStatus.FED:
      log.push(`Food supply stable (${foodResult.supply}/${foodResult.demand}).`);
      break;
    
    case FoodStatus.SURPLUS:
      log.push(`Surplus harvest! Supply (${foodResult.supply}) exceeds Demand (${foodResult.demand}).`);
      newWellness = Math.min(4, newWellness + 1) as RealmWellnessLevel;
      break;
  }

  // 2. Threat Effects (Addendum 008)
  const threatResult = applyThreatEffects(state);
  log.push(...threatResult.log);
  newWellness = Math.max(-4, Math.min(4, newWellness + threatResult.wellnessChange)) as RealmWellnessLevel;
  
  // Apply building damage
  threatResult.buildingDamage.forEach(({ buildingId, damage }) => {
    const building = updatedBuildings.find(b => b.id === buildingId);
    if (building) {
      building.currentHP = Math.max(0, building.currentHP - damage);
      // Check if disabled
      const threshold = Math.max(1, building.maxHP - 2);
      building.isDisabled = building.currentHP <= threshold;
    }
  });
  
  // Remove destroyed buildings (HP <= 0)
  const destroyedBuildings = updatedBuildings.filter(b => b.currentHP <= 0);
  if (destroyedBuildings.length > 0) {
    destroyedBuildings.forEach(b => log.push(`${b.defId} has been destroyed!`));
    updatedBuildings = updatedBuildings.filter(b => b.currentHP > 0);
  }

  // Calculate new threat level for state
  const { total: newThreat } = calculateTotalThreat(state);

  // 3. Title Progression (Addendum 011)
  const titleResult = processTitleProgression(state);
  log.push(...titleResult.log);

  // 4. Population Growth/Decline Logic
  if (populationChange === 0) {
    if (newWellness >= 4) {
      if (state.population.total < 50) {
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

  return {
    newWellness,
    populationChange,
    foodStatus: newFoodStatus,
    updatedBuildings,
    newTitles: titleResult.newTitles,
    newThreat,
    log
  };
}

