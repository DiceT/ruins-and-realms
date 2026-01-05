import { RealmState } from '../../types/realmTypes';
import { resolveAvailableTags } from '../tags/tagResolver';
import { getBuildingDef } from '../../utils/buildingRegistry';

export interface ValidationResult {
  canBuild: boolean;
  reason?: string; // Failure reason
}

/**
 * CAN BUILD CHECKER
 * Verifies:
 * 1. Building ID exists
 * 2. Resource Cost (Rings)
 * 3. Tag Requirements (Land/Infra)
 * 4. Building Dependency (Specific building exists)
 * 5. Population (Workers available - though this might be separate from construction cost?)
 *    - Note: Workers are usually required to OPERATE, not necessarily to BUILD (unless construction cost includes pop allocation).
 *    - Definition says `workers: number` (Assignment) and `cost: number` (Rings).
 */
export function canBuild(buildingId: string, state: RealmState): ValidationResult {
  const def = getBuildingDef(buildingId);
  if (!def) return { canBuild: false, reason: 'Invalid Building ID' };

  // 1. Check Cost
  if (state.rings < def.cost) {
    return { canBuild: false, reason: `Insufficient Rings (Need ${def.cost})` };
  }

  // 2. Check Requirements
  const activeTags = resolveAvailableTags(state);
  
  // Tag Requirements
  for (const reqTag of def.requires.tags) {
    if (!activeTags.includes(reqTag)) {
      return { canBuild: false, reason: `Missing Tag: ${reqTag}` };
    }
  }

  // Building Requirements (Prerequisites)
  if (def.requires.buildings && def.requires.buildings.length > 0) {
    const constructedIds = state.buildings.filter(b => b.isBuilt).map(b => b.defId);
    for (const reqBuild of def.requires.buildings) {
      if (!constructedIds.includes(reqBuild)) {
        // Human readable name would be better, but ID suffices for now
        return { canBuild: false, reason: `Requires Building: ${reqBuild}` };
      }
    }
  }

  // Title Requirements (Stub)
  if (def.requires.titles && def.requires.titles.length > 0) {
    // We don't track titles in state yet, assuming check passes or stub fails?
    // Let's assume pass if titles array is empty in state (which it doesn't exist yet).
    // Or fail if any titles are required? 
    // Most basic buildings don't require titles.
    // Advanced ones like Manor do.
    // TODO: Add Titles to RealmState
  }

  return { canBuild: true };
}
