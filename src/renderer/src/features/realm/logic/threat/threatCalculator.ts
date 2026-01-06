import { RealmState } from '../types/realmTypes';

/**
 * THREAT SYSTEM (Addendum 008)
 * Calculates cumulative threat from various sources:
 * - Unquiet Domains (clocks)
 * - Afflictions (clocks)
 * - Adjacent uncleansed domains (future)
 */

export interface ThreatSource {
  sourceId: string;
  sourceType: 'DOMAIN' | 'AFFLICTION' | 'ADJACENT' | 'UNIQUE';
  threatValue: number;
  hexId?: string;
}

export interface ThreatResult {
  total: number;
  sources: ThreatSource[];
}

/**
 * Calculate total threat from all sources
 */
export function calculateTotalThreat(state: RealmState): ThreatResult {
  const sources: ThreatSource[] = [];
  let total = 0;
  
  // From Unquiet Domain clocks
  state.clocks
    .filter(c => c.type === 'UNQUIET')
    .forEach(clock => {
      const value = clock.filled <= 2 ? 2 : 4;  // 2 for low, 4 for high
      total += value;
      sources.push({
        sourceId: clock.id,
        sourceType: 'DOMAIN',
        threatValue: value
      });
    });
  
  // From Affliction clocks
  state.clocks
    .filter(c => c.type === 'AFFLICTION')
    .forEach(clock => {
      total += 3;  // Flat 3 per active affliction
      sources.push({
        sourceId: clock.id,
        sourceType: 'AFFLICTION',
        threatValue: 3
      });
    });
  
  // Future: Adjacent uncleansed domains
  // total += countAdjacentDomains(state) * 1;
  
  return { total, sources };
}

/**
 * Get threat level category
 */
export function getThreatLevel(threat: number): 'PEACE' | 'NORMAL' | 'PRESSURE' | 'CRISIS' | 'SIEGE' {
  if (threat === 0) return 'PEACE';
  if (threat <= 3) return 'NORMAL';
  if (threat <= 6) return 'PRESSURE';
  if (threat <= 9) return 'CRISIS';
  return 'SIEGE';
}

/**
 * Apply threat effects during Dawn phase
 */
export interface ThreatDamageResult {
  wellnessChange: number;
  buildingDamage: { buildingId: string; damage: number }[];
  log: string[];
}

export function applyThreatEffects(state: RealmState): ThreatDamageResult {
  const { total } = calculateTotalThreat(state);
  const log: string[] = [];
  let wellnessChange = 0;
  const buildingDamage: { buildingId: string; damage: number }[] = [];
  
  const level = getThreatLevel(total);
  
  switch (level) {
    case 'PEACE':
      log.push('Peace reigns. No threats loom.');
      break;
      
    case 'NORMAL':
      log.push('Threats stir at the borders.');
      // 10% chance of outer building damage
      if (Math.random() < 0.1 && state.buildings.length > 0) {
        const randomBuilding = state.buildings[Math.floor(Math.random() * state.buildings.length)];
        buildingDamage.push({ buildingId: randomBuilding.id, damage: 1 });
        log.push(`${randomBuilding.defId} takes minor damage from threats.`);
      }
      break;
      
    case 'PRESSURE':
      log.push('Danger presses against the realm.');
      wellnessChange = -1;
      // Guaranteed building damage
      if (state.buildings.length > 0) {
        const randomBuilding = state.buildings[Math.floor(Math.random() * state.buildings.length)];
        buildingDamage.push({ buildingId: randomBuilding.id, damage: 1 });
        log.push(`${randomBuilding.defId} damaged by threats.`);
      }
      break;
      
    case 'CRISIS':
      log.push('CRISIS! The realm is under siege!');
      wellnessChange = -2;
      // Multiple buildings take damage
      const crisisBuildings = state.buildings.slice(0, 2);
      crisisBuildings.forEach(b => {
        buildingDamage.push({ buildingId: b.id, damage: 2 });
        log.push(`${b.defId} heavily damaged!`);
      });
      break;
      
    case 'SIEGE':
      log.push('CATASTROPHE! All is threatened!');
      wellnessChange = -3;
      // All buildings take damage
      state.buildings.forEach(b => {
        buildingDamage.push({ buildingId: b.id, damage: 1 });
      });
      if (state.buildings.length > 0) {
        log.push('All buildings take damage!');
      }
      break;
  }
  
  return { wellnessChange, buildingDamage, log };
}
