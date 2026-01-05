import { getConstructionTarget } from '../../logic/buildings/constructionManager';
import { BuildingInstance } from '../../types/realmTypes';
import { RealmState } from '../../types/realmTypes';
import { getBuildingDef } from '../../utils/buildingRegistry';

export interface MorningResult {
  income: number;
  upkeep: number; // For now just a sum
  netChange: number;
  updatedBuildings: BuildingInstance[]; // New field
  newTaxState: RealmState['tax'];
  newPatience: number;
  log: string[];
}

/**
 * PHASE 2: MORNING — Economy
 * - Collect Taxes (if tax turn)
 * - Collect Building Income
 * - Pay Upkeep (if any)
 */
export function processMorning(state: RealmState): MorningResult {
  const log: string[] = [];
  let income = 0;
  let upkeep = 0;
  const updatedBuildings: BuildingInstance[] = [];

  // 1. Iterate Constructed Buildings
  state.buildings.forEach(b => {
    let building = { ...b }; // Clone to avoid mutation of original if passed by ref

    // A. Construction Progress
    if (!building.isBuilt) {
      // Stub: Advance by 1 point per turn automatically?
      // Or does it require workers assigned?
      // For now, let's say it advances by 1 automatically (or via assigned workers logic later).
      // Let's assume 1 point per turn base rate.
      // We can't mutate 'b' directly if we want to return a clean log, 
      // but 'state' here is likely a draft or we need to return updates.
      // Wait, processMorning returns a result, it doesn't mutate state directly?
      // Actually, processTurn uses the result to calculate NET changes for Rings, but complex deep state updates?
      // processTurn logic: "state = { ...state, buildings: ... }"
      
      // We need to return specific building updates in MorningResult or handle it in the orchestrator?
      // Current MorningResult: income, upkeep, netChange.
      // It misses "buildingUpdates".
      
      // Let's log it for now and handle the mutation in Orchestrator? 
      // Or better: processMorning SHOULD return the new buildings list?
      // That changes the contract.
      
      // Alternative: Just log income here, and Orchestrator handles specific logic?
      // No, Orchestrator delegates "Morning Logic" to this function.
      // This function should probably return `newBuildings` list if it modifies them.
      // Advance by 1 point per turn (Base)
      building.constructionPoints += 1;
      
      const target = getConstructionTarget(building.defId);
      if (building.constructionPoints >= target) {
        building.isBuilt = true;
        
        // Log completion
        const def = getBuildingDef(building.defId);
        log.push(`Construction complete: ${def ? def.name : building.defId}`);
      }
    }

    // B. Income (Only if built - could be newly built this turn!)
    if (building.isBuilt) {
       const def = getBuildingDef(building.defId);
       if (def) {
         if (def.income > 0) {
           income += def.income;
         }
       }
    }

    updatedBuildings.push(building);
  });

  // 2. Tax Logic
  let newTaxState = { ...state.tax };
  let newPatience = state.baronPatience;
  
  // If we are currently DUE, we attempt to resolve it (Pay or Default)
  // This happens BEFORE decrementing the next cycle (effectively "Day 0" action)
  if (newTaxState.status === 'DUE') {
      const currentWealth = state.rings + (income - upkeep); // Using computed wealth including this morning's income
      
      if (currentWealth >= newTaxState.amount) {
          // PAY
          upkeep += newTaxState.amount;
          newTaxState.status = 'PAID';
          newTaxState.daysUntilDue = 4; // Reset to 4
          newPatience = Math.min(100, newPatience + 5);
          log.push(`Tax Collected! The Baron is pleased. (${newTaxState.amount} Rings). Patience: ${newPatience}`);
      } else {
          // DEFAULT
          newTaxState.status = 'OVERDUE';
          // Keep days at 0? Or reset?
          // If we default, Baron is mad, but does the debt persist?
          // For simple simulation, let's say debt is wiped but Patience hit hard.
          // Or status stays OVERDUE until you assume manual action?
          // Let's reset cycle but with big penalty.
          newTaxState.daysUntilDue = 4; 
          newTaxState.status = 'PAID'; // "Forgiven" via penalty? No, that's weird.
          // Let's keep it simple: You missed it. Cycle resets. Baron hates you.
          newPatience = Math.max(0, newPatience - 15);
          log.push(`TAX DEFAULT! 4 Turns until next. Penalty applied. Patience: ${newPatience}`);
      }
  } 
  // Else if we are OVERDUE? (Maybe handle same as due, or separate consequence)
  
  // NOW handle the countdown for the *next* or *current* cycle.
  // Only decrement if we are 'PAID' (i.e. normal countdown) or just reset.
  // If we just paid/reset above, daysUntilDue is 4.
  // If we were at 1, we go to 0.
  
  if (newTaxState.status === 'PAID') {
      if (newTaxState.daysUntilDue > 0) {
          newTaxState.daysUntilDue -= 1;
      }
      
      if (newTaxState.daysUntilDue === 0) {
          newTaxState.status = 'DUE';
          // We DO NOT auto-pay here. We wait for next turn (or manual action phase).
          log.push('Taxes are DUE this turn!');
      }
  }

  // Re-calculate Net Change with Tax included in Upkeep
  const finalNetChange = income - upkeep;
  
  if (income > 0 || upkeep > 0) {
      log.push(`Morning arrives. Income: ${income}, Upkeep: ${upkeep}. Net: ${finalNetChange} Rings.`);
  }

  return {
    income,
    upkeep,
    netChange: finalNetChange, // Updated variable name
    updatedBuildings,
    newTaxState,
    newPatience,
    log
  };
}
