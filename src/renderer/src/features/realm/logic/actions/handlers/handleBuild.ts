import { RealmState, OwnedHex } from '../../../types/realmTypes';
import { BuildActionPayload } from '../../../config/actions';
import { canBuild } from '../../buildings/buildingValidator';
import { startConstruction } from '../../buildings/constructionManager';
import { getBuildingDef } from '../../../utils/buildingRegistry';
import { calculateTerrainCost, canBuildOnTerrain } from '../../buildings/terrainModifiers';

export interface ActionResult {
  newState: RealmState;
  success: boolean;
  message?: string;
}

export function handleBuild(state: RealmState, payload: BuildActionPayload): ActionResult {
  // 1. Validate building requirements
  const validation = canBuild(payload.buildingId, state);
  if (!validation.canBuild) {
    return { newState: state, success: false, message: validation.reason };
  }

  // 2. Get building definition
  const def = getBuildingDef(payload.buildingId);
  if (!def) return { newState: state, success: false, message: 'Invalid building definition' };

  // 3. Find target hex
  const targetHex = state.ownedHexes.find(h => h.id === payload.hexId);
  if (!targetHex) {
    return { newState: state, success: false, message: 'Hex not owned' };
  }

  // 4. Check terrain restrictions (Addendum 005)
  const terrainCheck = canBuildOnTerrain(payload.buildingId, targetHex.terrain);
  if (!terrainCheck.allowed) {
    return { newState: state, success: false, message: terrainCheck.reason };
  }

  // 5. Check plot capacity (Addendum 004)
  const buildingSize = def.size || 10;  // Default 10 BP per building
  const remainingCapacity = targetHex.buildingPoints.total - targetHex.buildingPoints.used;
  if (buildingSize > remainingCapacity) {
    return { 
      newState: state, 
      success: false, 
      message: `Not enough space. Need ${buildingSize} BP, only ${remainingCapacity} available.` 
    };
  }

  // 6. Calculate terrain-adjusted cost
  const adjustedCost = calculateTerrainCost(def.cost, targetHex.terrain);
  if (state.rings < adjustedCost) {
    return { newState: state, success: false, message: `Not enough Rings. Need ${adjustedCost}.` };
  }

  // 7. Create building instance
  const newBuilding = startConstruction(payload.buildingId, payload.hexId);

  // 8. Update hex capacity
  const updatedHexes = state.ownedHexes.map(h => 
    h.id === payload.hexId 
      ? { ...h, buildingPoints: { ...h.buildingPoints, used: h.buildingPoints.used + buildingSize } }
      : h
  );

  // 9. Update state
  const newState = {
    ...state,
    rings: state.rings - adjustedCost,
    buildings: [...state.buildings, newBuilding],
    ownedHexes: updatedHexes
  };

  return {
    newState,
    success: true,
    message: `Started construction of ${def.name} (${adjustedCost} Rings)`
  };
}

