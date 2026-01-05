import { RealmState } from '../../../types/realmTypes';
import { ActionResult } from '../handleBuild';
import { ExploreActionPayload } from '../../../config/actions';

export function handleExplore(state: RealmState, payload: ExploreActionPayload): ActionResult {
  // 1. Logic: Simulate a Dungeon Run
  // In the future, this would pause the Realm, switch to Dungeon View, and wait for result.
  // For now (Option A), it's a Text Simulation.

  const rng = Math.random();
  let lootRings = 0;
  let eventLog = '';
  // let artifact = null;

  // Simple Loot Table
  if (rng > 0.8) {
      // Great Success
      lootRings = Math.floor(Math.random() * 50) + 50; // 50-100
      eventLog = `Great Expedition! The party creates a safe path and returns with chests overflowing. (+${lootRings} Rings)`;
  } else if (rng > 0.4) {
      // Standard Success
      lootRings = Math.floor(Math.random() * 30) + 10; // 10-40
      eventLog = `Successful Delve. The ruins yielded some valuables. (+${lootRings} Rings)`;
  } else {
      // Failure / Minor
      lootRings = Math.floor(Math.random() * 5); // 0-5
      eventLog = 'The expedition struggled against the darkness. They returned with scrap.';
  }

  // 2. Apply Result
  const newState = {
      ...state,
      rings: state.rings + lootRings
  };

  return {
    newState,
    success: true,
    message: eventLog
  };
}
