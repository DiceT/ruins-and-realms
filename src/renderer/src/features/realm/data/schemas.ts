import { RealmCurrency, RealmPopulation, RealmWellnessLevel } from '../types/realmTypes';

/**
 * TAGS
 * Interpreted from realm-tags.json
 */

export type TagId = string; // e.g., "TIMBER", "SMITHING"

export type TagCategory = 'resource' | 'infrastructure' | 'special' | 'title';

export interface TagDefinition {
  id: TagId;
  name: string;
  description: string;
  color: string; // Hex code
  icon: string; // Icon name
  
  // Optional metadata found in various tag types
  sources?: string[];    // Where it comes from (Resource/Special)
  granted_by?: string[]; // Buildings that give it (Infrastructure)
  effects?: string[];    // Text descriptions of effects
  requirements?: string[]; // For Titles
  unlocks?: string[];      // For Titles
}

/**
 * BUILDINGS
 * Interpreted from realm-buildings.json
 */

export type BuildingId = string; // e.g., "farmstead", "mine"

export interface BuildingCost {
  rings: RealmCurrency;
  population?: number; // Some events might cost pop? Usually just works.
}

export interface BuildingRequirements {
  tags: TagId[];
  buildings: BuildingId[];
  titles: string[]; // Title IDs
  terrain?: string[]; // "Forest", "Hills" etc.
}

export interface BuildingGrants {
  tags: TagId[];
  effects: string[]; // Text description of unique effects
}

export interface BuildingUpgrade {
  cost: RealmCurrency;
  bonus: string; // Description of what it gives
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  
  // Stats
  hp: number;
  size: 1 | 2 | 4; // Plot size
  cost: RealmCurrency;
  rank: number;
  workers: number; // Required to operate
  construction: number; // Turns to build
  
  // Economy
  income: RealmCurrency; // Rings per turn
  food: number;
  
  // Logic
  requires: BuildingRequirements;
  grants: BuildingGrants;
  
  // Metadata
  upgrades?: Record<string, BuildingUpgrade>; // "level_2": { ... }
}
