
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

export enum FoodStatus {
  SURPLUS = 'SURPLUS',
  STABLE = 'STABLE',
  STARVING = 'STARVING'
}

export interface RealmDate {
  turn: number; // Absolute turn count (1 turn = 1 week)
}

import { TurnPhase } from './turnTypes';

export interface BuildingInstance {
  id: string;          // Unique Instance ID
  defId: string;       // Reference to BuildingDefinition ID (e.g., "farm")
  hexId: string;       // Location (Anchor Hex)
  constructionPoints: number; // Current construction progress
  isBuilt: boolean;    // True if constructionPoints >= def.construction
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
  baronPatience: number; // 0-100, fail at 0?

  phase: TurnPhase;
  ownedHexes: { id: string; landTags: string[] }[];
  actionPoints: { current: number; max: number };
}

export const getWellnessStatus = (level: RealmWellnessLevel): RealmWellnessStatus => {
  if (level <= -4) return RealmWellnessStatus.CRISIS;
  if (level <= -1) return RealmWellnessStatus.TROUBLED;
  if (level === 0) return RealmWellnessStatus.STABLE;
  if (level <= 3) return RealmWellnessStatus.CONTENT;
  return RealmWellnessStatus.THRIVING;
};
