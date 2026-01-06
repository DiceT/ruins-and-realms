
export type RealmCurrency = number; // Rings

export interface RealmPopulation {
  total: number;
  availableWorkers: number;
  assignedWorkers: number;
}

// -4 to +4
export type RealmWellnessLevel = number;

export enum RealmWellnessStatus {
  CRISIS = 'CRISIS',       // <= -4
  TROUBLED = 'TROUBLED',   // -3 to -1
  STABLE = 'STABLE',       // 0
  CONTENT = 'CONTENT',     // +1 to +3
  THRIVING = 'THRIVING'    // >= +4
}

// 4-tier food system per design doc
export enum FoodStatus {
  SURPLUS = 'SURPLUS',     // +1 Wellness/turn, growth possible
  FED = 'FED',             // Stable (renamed from STABLE)
  SHORTAGE = 'SHORTAGE',   // -1 Wellness/turn, no growth
  STARVATION = 'STARVATION' // -2 Wellness/turn, population loss
}

export interface RealmDate {
  turn: number; // Absolute turn count (1 turn = 1 week)
}

import { TurnPhase } from './turnTypes';

// === BUILDING SYSTEM (Addendum 001) ===

export const DISABLED_THRESHOLD_OFFSET = 2;

export function getDisabledThreshold(maxHP: number): number {
  return Math.max(1, maxHP - DISABLED_THRESHOLD_OFFSET);
}

export function isBuildingDisabled(currentHP: number, maxHP: number): boolean {
  return currentHP <= getDisabledThreshold(maxHP);
}

export interface BuildingInstance {
  id: string;          // Unique Instance ID
  defId: string;       // Reference to BuildingDefinition ID (e.g., "farm")
  hexId: string;       // Location (Anchor Hex)
  currentHP: number;   // 0 during construction, builds up to maxHP
  maxHP: number;       // Cached from definition (def.hp)
  isBuilt: boolean;    // True when currentHP >= maxHP
  isDisabled: boolean; // True when HP too low to function
}

// === TITLES & CLOCKS (Addendum 002) ===

export type TitleId = 'SURVIVOR' | 'FOUNDER' | 'THANE' | 'LORD' | 'WARDEN' | 'SAGE' | 'HIGH_PRIEST';

export interface Clock {
  id: string;
  name: string;
  type: 'AFFLICTION' | 'UNQUIET' | 'BARON' | 'CUSTOM';
  segments: number;      // Total segments (usually 4)
  filled: number;        // Currently filled
  sourceId?: string;     // Related hex, domain, or aspect
}

// === PLOT CAPACITY & TERRAIN (Addendum 004/005) ===

export type TerrainType = 'PLAINS' | 'FOREST' | 'HILLS' | 'MOUNTAIN' | 'MARSH' | 'COAST' | 'RIVER' | 'RUINS';

export interface OwnedHex {
  id: string;
  landTags: string[];           // Resource tags (FERTILE, TIMBER, etc.)
  terrain: TerrainType;
  buildingPoints: {
    total: number;              // Capacity (default 100)
    used: number;               // Consumed by buildings
  };
}

export const DEFAULT_HEX_CAPACITY = 100;

export function createOwnedHex(id: string, terrain: TerrainType = 'PLAINS', tags: string[] = []): OwnedHex {
  return {
    id,
    landTags: tags,
    terrain,
    buildingPoints: {
      total: DEFAULT_HEX_CAPACITY,
      used: 0
    }
  };
}

// === REALM STATE ===

// Loot & Commerce (Addendum 010)
export type LootRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface LootItem {
  id: string;
  name: string;
  rarity: LootRarity;
  value: number;           // Sell value in Rings
  effects?: {
    wellness?: number;
    threat?: number;
    tag?: string;
  };
  sourceHexId?: string;    // Where it was found
}

export interface MerchantVisit {
  id: string;
  name: string;
  inventory: LootItem[];
  wantsToBuy: string[];    // Item IDs merchant will buy
  departsTurn: number;     // When merchant leaves
}

export interface RealmState {
  rings: RealmCurrency;
  population: RealmPopulation;
  wellness: RealmWellnessLevel;
  foodStatus: FoodStatus;
  date: RealmDate;
  buildings: BuildingInstance[];
  
  // Politics
  tax: {
    amount: number;
    daysUntilDue: number;
    status: 'PAID' | 'DUE' | 'OVERDUE';
  };
  baronPatience: number;

  phase: TurnPhase;
  ownedHexes: OwnedHex[];
  actionPoints: { current: number; max: number };

  // Addendum 002: State fields
  titles: TitleId[];
  threat: number;
  lastDelveTurn: number;
  clocks: Clock[];
  
  // Addendum 010: Loot & Commerce
  inventory: LootItem[];
  activeMerchant?: MerchantVisit;
}

export const getWellnessStatus = (level: RealmWellnessLevel): RealmWellnessStatus => {
  if (level <= -4) return RealmWellnessStatus.CRISIS;
  if (level <= -1) return RealmWellnessStatus.TROUBLED;
  if (level === 0) return RealmWellnessStatus.STABLE;
  if (level <= 3) return RealmWellnessStatus.CONTENT;
  return RealmWellnessStatus.THRIVING;
};
