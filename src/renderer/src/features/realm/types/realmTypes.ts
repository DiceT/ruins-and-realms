
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

// === REALM STATE ===

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

  // Addendum 002: New state fields
  titles: TitleId[];
  threat: number;          // Cumulative threat level (0+)
  lastDelveTurn: number;   // Turn number of last DELVE (0 = never)
  clocks: Clock[];
}

export const getWellnessStatus = (level: RealmWellnessLevel): RealmWellnessStatus => {
  if (level <= -4) return RealmWellnessStatus.CRISIS;
  if (level <= -1) return RealmWellnessStatus.TROUBLED;
  if (level === 0) return RealmWellnessStatus.STABLE;
  if (level <= 3) return RealmWellnessStatus.CONTENT;
  return RealmWellnessStatus.THRIVING;
};
