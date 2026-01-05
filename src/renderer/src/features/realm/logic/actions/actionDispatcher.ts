import { RealmState } from '../../types/realmTypes';
import { RealmAction, RealmActionType, BuildActionPayload, ExploreActionPayload } from '../../config/actions';
import { handleBuild, ActionResult } from './handlers/handleBuild';
import { handleExplore } from './handlers/handleExplore';

/**
 * EXECUTE ACTION
 * The central hub for all player actions in the Realm.
 * Enforces Action Point (AP) costs and routes to specific handlers.
 */
export function executeAction(state: RealmState, action: RealmAction): ActionResult {
  // 1. Check AP Availability
  // Free actions (if any) should bypass this.
  const AP_COST = 1; // Base cost for now
  if (state.actionPoints.current < AP_COST) {
    return { newState: state, success: false, message: 'Not enough Action Points.' };
  }

  let result: ActionResult;

  // 2. Route to Handler
  switch (action.type) {
    case RealmActionType.BUILD:
      result = handleBuild(state, action.payload as BuildActionPayload);
      break;
    
    // Stubs for future actions
    case RealmActionType.EXPLORE:
    case RealmActionType.EXPLORE:
      result = handleExplore(state, action.payload as ExploreActionPayload);
      break;
    case RealmActionType.REPAIR:
        return { newState: state, success: false, message: 'Repair not implemented' };
    default:
      return { newState: state, success: false, message: 'Unknown Action Type' };
  }

  // 3. Deduct AP (if success)
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
