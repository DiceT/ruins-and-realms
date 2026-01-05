import { BuildingInstance, RealmPopulation, FoodStatus } from '../../types/realmTypes';
import { getBuildingDef } from '../../utils/buildingRegistry';

// Per design doc: 4 population per 1 food demand
export const FOOD_PER_POPULATION_UNIT = 4;

export interface FoodCalculationResult {
  demand: number;
  supply: number;
  net: number;
  status: FoodStatus;
}

/**
 * Calculate Food Demand
 * Design doc: Population ÷ 4 (rounded up)
 */
export const calculateFoodDemand = (population: RealmPopulation): number => {
  return Math.ceil(population.total / FOOD_PER_POPULATION_UNIT);
};

/**
 * Calculate Food Supply
 * Iterates through buildings to find those that produce food.
 * Only counts operational (built AND not disabled) buildings.
 */
export const calculateFoodSupply = (buildings: BuildingInstance[]): number => {
  let supply = 0;

  buildings.forEach(b => {
    // Only count if built AND operational
    if (!b.isBuilt || b.isDisabled) return;

    const def = getBuildingDef(b.defId);
    if (def && typeof def.food === 'number') {
      supply += def.food;
    }
  });

  return supply;
};

/**
 * Calculate Complete Food Status
 * 4-tier system per design doc:
 * - SURPLUS: net >= +2
 * - FED: net >= 0
 * - SHORTAGE: net >= -1
 * - STARVATION: net < -1
 */
export const calculateFoodStatus = (population: RealmPopulation, buildings: BuildingInstance[]): FoodCalculationResult => {
  const demand = calculateFoodDemand(population);
  const supply = calculateFoodSupply(buildings);
  const net = supply - demand;

  let status: FoodStatus;
  
  if (net >= 2) {
    status = FoodStatus.SURPLUS;
  } else if (net >= 0) {
    status = FoodStatus.FED;
  } else if (net >= -1) {
    status = FoodStatus.SHORTAGE;
  } else {
    status = FoodStatus.STARVATION;
  }

  return { demand, supply, net, status };
};
