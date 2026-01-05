
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

export interface RealmDate {
  turn: number; // Absolute turn count (1 turn = 1 week)
}

export interface RealmState {
  rings: RealmCurrency;
  population: RealmPopulation;
  wellness: RealmWellnessLevel;
  date: RealmDate;
}

export const getWellnessStatus = (level: RealmWellnessLevel): RealmWellnessStatus => {
  if (level <= -4) return RealmWellnessStatus.CRISIS;
  if (level <= -1) return RealmWellnessStatus.TROUBLED;
  if (level === 0) return RealmWellnessStatus.STABLE;
  if (level <= 3) return RealmWellnessStatus.CONTENT;
  return RealmWellnessStatus.THRIVING;
};
