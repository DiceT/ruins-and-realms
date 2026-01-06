import { RealmState, getDisabledThreshold } from '../../../types/realmTypes';
import { ActionResult } from './handleBuild';
import { RepairActionPayload } from '../../../config/actions';

/**
 * HANDLE REPAIR ACTION
 * Repairs a damaged building or helps construction.
 * - Adds 1 HP per action (capped at maxHP)
 * - Can complete construction or restore disabled buildings
 */
export function handleRepair(state: RealmState, payload: RepairActionPayload): ActionResult {
  const building = state.buildings.find(b => b.id === payload.buildingId);
  
  if (!building) {
    return { 
      success: false, 
      message: 'Building not found.',
      newState: state 
    };
  }
  
  // Check if already at max HP
  if (building.currentHP >= building.maxHP) {
    return {
      success: false,
      message: `${building.defId} is already at full HP.`,
      newState: state
    };
  }
  
  // Add 1 HP (capped at max)
  const newHP = Math.min(building.maxHP, building.currentHP + 1);
  
  // Check status changes
  const wasDisabled = building.isDisabled;
  const wasUnbuilt = !building.isBuilt;
  const isNowBuilt = newHP >= building.maxHP;
  const threshold = getDisabledThreshold(building.maxHP);
  const isNowOperational = newHP > threshold;
  
  // Update building
  const updatedBuilding = {
    ...building,
    currentHP: newHP,
    isBuilt: building.isBuilt || isNowBuilt,
    isDisabled: !isNowOperational
  };
  
  // Generate appropriate message
  let message = `Repaired ${building.defId} (+1 HP, now ${newHP}/${building.maxHP})`;
  if (wasUnbuilt && isNowBuilt) {
    message = `🏗️ Construction complete: ${building.defId}!`;
  } else if (wasDisabled && isNowOperational) {
    message = `🔧 ${building.defId} is operational again!`;
  }
  
  // Update state with new building
  const newState: RealmState = {
    ...state,
    buildings: state.buildings.map(b => b.id === building.id ? updatedBuilding : b)
  };
  
  return {
    newState,
    success: true,
    message
  };
}
