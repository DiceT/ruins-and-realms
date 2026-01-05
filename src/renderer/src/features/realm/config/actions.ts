import { BuildingId } from '../data/schemas';

export enum RealmActionType {
  BUILD = 'BUILD',
  EXPLORE = 'EXPLORE',
  REPAIR = 'REPAIR', // or MAINTAIN
  MANAGE_WORKERS = 'MANAGE_WORKERS' // Free action perhaps?
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

// Union of all payloads
export type RealmActionPayload = BuildActionPayload | ExploreActionPayload; // | Others

export interface RealmAction {
  type: RealmActionType;
  payload: RealmActionPayload;
}
