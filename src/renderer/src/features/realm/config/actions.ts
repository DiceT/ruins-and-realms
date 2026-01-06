import { BuildingId } from '../data/schemas';
import { TerrainType } from '../types/realmTypes';

// Addendum 003: DELVE cooldown
export const DELVE_COOLDOWN_TURNS = 4;  // 4 turns = 1 month

// Addendum 009: Full action type expansion
export enum RealmActionType {
  // Core Actions (1 AP each)
  BUILD = 'BUILD',
  REPAIR = 'REPAIR',
  EXPLORE = 'EXPLORE',
  REST = 'REST',
  
  // Special Actions
  DELVE = 'DELVE',           // Enter Domain (consumes all AP)
  CLAIM = 'CLAIM',           // Claim new hex (1 AP)
  CLEAR = 'CLEAR',           // Clear threat/hazard from hex (1 AP)
  
  // Economic Actions
  TRADE = 'TRADE',           // Trade with visiting merchant (1 AP)
  
  // Social Actions
  FESTIVAL = 'FESTIVAL',     // Hold festival for Wellness (2 AP)
  DECREE = 'DECREE',         // Issue decree for realm effect (1 AP)
  
  // Research/Study
  RESEARCH = 'RESEARCH',     // Study at library/ruins (1 AP)
  
  // Free Actions
  MANAGE_WORKERS = 'MANAGE_WORKERS'
}

export interface BaseActionPayload {
  // Common fields (if any)
}

export interface BuildActionPayload extends BaseActionPayload {
  buildingId: BuildingId;
  hexId: string;
}

export interface ExploreActionPayload extends BaseActionPayload {
  targetHexId?: string;
}

export interface DelveActionPayload extends BaseActionPayload {
  domainId?: string;
}

export interface RepairActionPayload extends BaseActionPayload {
  buildingId: string;
}

export interface ClaimActionPayload extends BaseActionPayload {
  hexId: string;
  terrain: TerrainType;
  tags?: string[];
}

export interface TradeActionPayload extends BaseActionPayload {
  merchantId: string;
  itemsToBuy?: string[];
  itemsToSell?: string[];
}

export interface FestivalActionPayload extends BaseActionPayload {
  type: 'HARVEST' | 'FOUNDING' | 'VICTORY' | 'RELIGIOUS';
  ringsSpent: number;
}

export interface DecreeActionPayload extends BaseActionPayload {
  decreeType: 'TAX_RELIEF' | 'CONSCRIPTION' | 'RATIONING' | 'CELEBRATION';
}

export interface ResearchActionPayload extends BaseActionPayload {
  buildingId: string;  // Library, scriptorium, etc.
  topic?: string;
}

// Union of all payloads
export type RealmActionPayload = 
  | BuildActionPayload 
  | ExploreActionPayload 
  | DelveActionPayload 
  | RepairActionPayload
  | ClaimActionPayload
  | TradeActionPayload
  | FestivalActionPayload
  | DecreeActionPayload
  | ResearchActionPayload;

export interface RealmAction {
  type: RealmActionType;
  payload: RealmActionPayload;
}
