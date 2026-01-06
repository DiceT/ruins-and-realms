import { TerrainType } from '../types/realmTypes';

/**
 * TERRAIN MODIFIERS (Addendum 005)
 * Each terrain type modifies build costs, starting HP, and restrictions
 */

export interface TerrainModifier {
  costMultiplier: number;       // Ring cost adjustment (1.0 = normal)
  hpModifier: number;           // Starting HP adjustment (-2 to +2)
  buildTimeModifier: number;    // Construction time adjustment (1.0 = normal)
  restricted: string[];         // Building types that CANNOT be built here
  exclusive: string[];          // Building types that CAN ONLY be built here
  bonusTags: string[];          // Extra tags granted when building here
}

export const TERRAIN_MODIFIERS: Record<TerrainType, TerrainModifier> = {
  PLAINS: {
    costMultiplier: 1.0,
    hpModifier: 0,
    buildTimeModifier: 1.0,
    restricted: [],
    exclusive: [],
    bonusTags: ['FARMLAND']
  },
  
  FOREST: {
    costMultiplier: 0.8,        // Cheaper due to timber
    hpModifier: 0,
    buildTimeModifier: 1.2,     // Slower (clearing trees)
    restricted: ['quarry', 'mine'],
    exclusive: ['lumber_camp', 'hunting_lodge', 'charcoal_pit'],
    bonusTags: ['TIMBER']
  },
  
  HILLS: {
    costMultiplier: 1.2,
    hpModifier: +1,             // Sturdier foundations
    buildTimeModifier: 1.3,
    restricted: ['farm', 'fishery'],
    exclusive: ['quarry', 'watchtower'],
    bonusTags: ['STONE']
  },
  
  MOUNTAIN: {
    costMultiplier: 1.5,
    hpModifier: +2,
    buildTimeModifier: 1.5,
    restricted: ['farm', 'fishery', 'market'],
    exclusive: ['mine', 'fortress'],
    bonusTags: ['ORE', 'DEFENSIBLE']
  },
  
  MARSH: {
    costMultiplier: 1.3,
    hpModifier: -1,             // Poor foundations
    buildTimeModifier: 1.4,
    restricted: ['quarry', 'mine', 'fortress'],
    exclusive: ['herbalist', 'peat_works'],
    bonusTags: ['HERBS']
  },
  
  COAST: {
    costMultiplier: 1.0,
    hpModifier: 0,
    buildTimeModifier: 1.0,
    restricted: ['mine', 'quarry'],
    exclusive: ['fishery', 'dock', 'lighthouse'],
    bonusTags: ['FISH', 'TRADE']
  },
  
  RIVER: {
    costMultiplier: 0.9,        // Good transport
    hpModifier: 0,
    buildTimeModifier: 0.9,
    restricted: ['mine'],
    exclusive: ['mill', 'ferry'],
    bonusTags: ['WATER']
  },
  
  RUINS: {
    costMultiplier: 0.7,        // Salvage materials
    hpModifier: -1,             // Unstable
    buildTimeModifier: 0.8,
    restricted: [],
    exclusive: ['excavation'],
    bonusTags: ['SALVAGE', 'MYSTERY']
  }
};

/**
 * Calculate adjusted build cost based on terrain
 */
export function calculateTerrainCost(baseCost: number, terrain: TerrainType): number {
  const modifier = TERRAIN_MODIFIERS[terrain];
  return Math.ceil(baseCost * modifier.costMultiplier);
}

/**
 * Calculate adjusted starting HP based on terrain
 */
export function calculateTerrainHP(baseHP: number, terrain: TerrainType): number {
  const modifier = TERRAIN_MODIFIERS[terrain];
  return Math.max(1, baseHP + modifier.hpModifier);
}

/**
 * Check if a building type can be built on this terrain
 */
export function canBuildOnTerrain(buildingDefId: string, terrain: TerrainType): { allowed: boolean; reason?: string } {
  const modifier = TERRAIN_MODIFIERS[terrain];
  
  // Check restricted
  if (modifier.restricted.includes(buildingDefId)) {
    return { allowed: false, reason: `${buildingDefId} cannot be built on ${terrain}` };
  }
  
  // Check if another terrain requires this building exclusively
  for (const [terrainKey, mod] of Object.entries(TERRAIN_MODIFIERS)) {
    if (terrainKey !== terrain && mod.exclusive.includes(buildingDefId)) {
      return { allowed: false, reason: `${buildingDefId} can only be built on ${terrainKey}` };
    }
  }
  
  return { allowed: true };
}
