import { RealmState } from '../../../types/realmTypes';
import { ActionResult } from './handleBuild';
import { DelveActionPayload, DELVE_COOLDOWN_TURNS } from '../../../config/actions';

/**
 * HANDLE DELVE ACTION
 * Enter a Domain for dungeon delving.
 * - Can only DELVE once per month (4-turn cycle)
 * - Month boundaries are turns 1, 5, 9, 13... (where turn % 4 === 1)
 * - Allows back-to-back delves at month boundary (e.g., turn 4 then turn 5)
 * - Consumes ALL remaining action points
 * - For now, simulates outcome with text (Option A from design doc)
 */
export function handleDelve(state: RealmState, payload: DelveActionPayload): ActionResult {
  // 1. Check if already delved this month (Addendum 003 - month-based reset)
  const currentMonth = Math.ceil(state.date.turn / DELVE_COOLDOWN_TURNS);
  const lastDelveMonth = state.lastDelveTurn > 0 
    ? Math.ceil(state.lastDelveTurn / DELVE_COOLDOWN_TURNS) 
    : 0;
  
  if (lastDelveMonth === currentMonth) {
    const nextMonthStart = currentMonth * DELVE_COOLDOWN_TURNS + 1;
    const turnsUntilReset = nextMonthStart - state.date.turn;
    return { 
      success: false, 
      message: `Already delved this month. DELVE resets in ${turnsUntilReset} turn(s).`,
      newState: state
    };
  }

  // 2. Check if any AP available (DELVE consumes all)
  if (state.actionPoints.current < 1) {
    return {
      success: false,
      message: 'No Action Points remaining for DELVE.',
      newState: state
    };
  }

  // 3. Simulate Dungeon Delve (Option A: Text Simulation)
  // In future, this would transition to the Dungeon View
  const rng = Math.random();
  let lootRings = 0;
  let eventLog = '';

  if (rng > 0.8) {
    // Great Success
    lootRings = Math.floor(Math.random() * 50) + 50; // 50-100
    eventLog = `Great Expedition! The party creates a safe path and returns with chests overflowing. (+${lootRings} Rings)`;
  } else if (rng > 0.4) {
    // Standard Success
    lootRings = Math.floor(Math.random() * 30) + 10; // 10-40
    eventLog = `Successful Delve. The ruins yielded some valuables. (+${lootRings} Rings)`;
  } else if (rng > 0.1) {
    // Minor/Failure
    lootRings = Math.floor(Math.random() * 5); // 0-5
    eventLog = 'The expedition struggled against the darkness. They returned with scrap.';
  } else {
    // Disaster
    lootRings = 0;
    eventLog = 'The delve went terribly wrong. The party barely escaped with their lives.';
  }

  // 4. Apply Result
  const newState: RealmState = {
    ...state,
    rings: state.rings + lootRings,
    lastDelveTurn: state.date.turn,  // Mark cooldown start
    actionPoints: {
      ...state.actionPoints,
      current: 0  // DELVE consumes all AP
    }
  };

  return {
    newState,
    success: true,
    message: eventLog
  };
}
