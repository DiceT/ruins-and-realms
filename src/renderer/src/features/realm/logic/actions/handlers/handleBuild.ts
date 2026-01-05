import { RealmState } from '../../../types/realmTypes';
import { BuildActionPayload } from '../../../config/actions';
import { canBuild } from '../../buildings/buildingValidator';
import { startConstruction } from '../../buildings/constructionManager';
import { getBuildingDef } from '../../../utils/buildingRegistry';

export interface ActionResult {
  newState: RealmState;
  success: boolean;
  message?: string;
}

export function handleBuild(state: RealmState, payload: BuildActionPayload): ActionResult {
  // 1. Validate
  const validation = canBuild(payload.buildingId, state);
  if (!validation.canBuild) {
    return { newState: state, success: false, message: validation.reason };
  }

  // 2. Get Def for Cost
  const def = getBuildingDef(payload.buildingId);
  if (!def) return { newState: state, success: false, message: 'Invalid Def' };

  // 3. Create Instance
  const newBuilding = startConstruction(payload.buildingId, payload.hexId);

  // 4. Update State
  // - Deduct Rings
  // - Add Building
  const newState = {
    ...state,
    rings: state.rings - def.cost,
    buildings: [...state.buildings, newBuilding]
  };

  return {
    newState,
    success: true,
    message: `Started construction of ${def.name}`
  };
}
