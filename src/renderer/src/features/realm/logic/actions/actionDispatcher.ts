import { RealmState } from '../../types/realmTypes';
import { RealmAction, RealmActionType, BuildActionPayload, ExploreActionPayload, DelveActionPayload, RepairActionPayload } from '../../config/actions';
import { handleBuild, ActionResult } from './handlers/handleBuild';
import { handleExplore } from './handlers/handleExplore';
import { handleDelve } from './handlers/handleDelve';
import { handleRepair } from './handlers/handleRepair';

/**
 * EXECUTE ACTION
 * The central hub for all player actions in the Realm.
 * Enforces Action Point (AP) costs and routes to specific handlers.
 */
export function executeAction(state: RealmState, action: RealmAction): ActionResult {
  // Free actions bypass AP check
  if (action.type === RealmActionType.MANAGE_WORKERS) {
    return { newState: state, success: true, message: 'Workers managed.' };
  }

  // 1. Check AP Availability
  const AP_COST = 1;
  if (state.actionPoints.current < AP_COST) {
    return { newState: state, success: false, message: 'Not enough Action Points.' };
  }

  let result: ActionResult;

  // 2. Route to Handler
  switch (action.type) {
    case RealmActionType.BUILD:
      result = handleBuild(state, action.payload as BuildActionPayload);
      break;
    
    case RealmActionType.EXPLORE:
      result = handleExplore(state, action.payload as ExploreActionPayload);
      break;

    case RealmActionType.DELVE:
      // DELVE handles its own AP consumption (all AP)
      result = handleDelve(state, action.payload as DelveActionPayload);
      // Don't deduct AP again - handleDelve already consumed all
      return result;

    case RealmActionType.REST:
      // Simple +1 Wellness
      result = {
        newState: {
          ...state,
          wellness: Math.min(4, state.wellness + 1)
        },
        success: true,
        message: 'The realm rests. (+1 Wellness)'
      };
      break;

    case RealmActionType.REPAIR:
      result = handleRepair(state, action.payload as RepairActionPayload);
      break;

    default:
      return { newState: state, success: false, message: 'Unknown Action Type' };
  }

  // 3. Deduct AP (if success) - except for DELVE which handles its own
  if (result.success) {
    result.newState = {
      ...result.newState,
      actionPoints: {
        ...result.newState.actionPoints,
        current: result.newState.actionPoints.current - AP_COST
      }
    };
  }

  return result;
}
