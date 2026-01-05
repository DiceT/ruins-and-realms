import { BuildingId } from '../data/schemas';

// Addendum 003: DELVE cooldown
export const DELVE_COOLDOWN_TURNS = 4;  // 4 turns = 1 month

export enum RealmActionType {
  BUILD = 'BUILD',
  EXPLORE = 'EXPLORE',
  DELVE = 'DELVE',       // Enter a Domain (consumes all actions)
  REPAIR = 'REPAIR',     // Repair damaged building or help construction
  REST = 'REST',         // Simple Wellness boost
  MANAGE_WORKERS = 'MANAGE_WORKERS' // Free action
}

export interface BaseActionPayload {
  // Common fields (if any)
}

export interface BuildActionPayload extends BaseActionPayload {
  buildingId: BuildingId;
  hexId: string;
}

export interface ExploreActionPayload extends BaseActionPayload {
  targetHexId?: string; // Optional context, defaults to "Generic Expedition"
}

export interface DelveActionPayload extends BaseActionPayload {
  domainId?: string; // Target domain to delve into
}

export interface RepairActionPayload extends BaseActionPayload {
  buildingId: string;
}

// Union of all payloads
export type RealmActionPayload = BuildActionPayload | ExploreActionPayload | DelveActionPayload | RepairActionPayload;

export interface RealmAction {
  type: RealmActionType;
  payload: RealmActionPayload;
}
