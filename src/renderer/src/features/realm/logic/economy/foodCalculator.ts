import { BuildingInstance, RealmPopulation, FoodStatus } from '../../types/realmTypes';
import { getBuildingDef } from '../../utils/buildingRegistry';

export const FOOD_CONSUMPTION_PER_POP = 1;

export interface FoodCalculationResult {
  demand: number;
  supply: number;
  net: number;
  status: FoodStatus;
}

/**
 * Calculate Food Demand
 * Base: 1 Food per Population
 */
export const calculateFoodDemand = (population: RealmPopulation): number => {
  return population.total * FOOD_CONSUMPTION_PER_POP;
};

/**
 * Calculate Food Supply
 * Iterates through buildings to find those that produce food.
 */
export const calculateFoodSupply = (buildings: BuildingInstance[]): number => {
  let supply = 0;

  buildings.forEach(b => {
    if (!b.isBuilt) return;

    const def = getBuildingDef(b.defId);
    if (def && typeof def.food === 'number') {
      supply += def.food;
    }
  });

  return supply;
};

/**
 * Calculate Complete Food Status
 */
export const calculateFoodStatus = (population: RealmPopulation, buildings: BuildingInstance[]): FoodCalculationResult => {
  const demand = calculateFoodDemand(population);
  const supply = calculateFoodSupply(buildings);
  const net = supply - demand;

  let status = FoodStatus.STABLE;
  if (net > 0) status = FoodStatus.SURPLUS;
  if (net < 0) status = FoodStatus.STARVING;

  return { demand, supply, net, status };
};
