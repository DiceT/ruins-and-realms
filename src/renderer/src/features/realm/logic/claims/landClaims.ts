import { RealmState, OwnedHex, createOwnedHex, TerrainType } from '../types/realmTypes';

/**
 * LAND CLAIMS (Addendum 007)
 * Handles hex claiming with contested chances
 */

export type ClaimResult = 'SUCCESS' | 'CONTESTED' | 'DENIED';

export interface ClaimAttemptResult {
  result: ClaimResult;
  newHex?: OwnedHex;
  contestedBy?: string;  // NPC faction name if contested
  message: string;
}

export interface DisputeRequirements {
  rings: number;
  population: number;
  titles: string[];
}

/**
 * Attempt to claim an unclaimed hex
 * 37.5% chance of contested claim
 */
export function attemptClaim(
  state: RealmState, 
  hexId: string, 
  terrain: TerrainType,
  tags: string[] = []
): ClaimAttemptResult {
  // Check if already owned
  if (state.ownedHexes.some(h => h.id === hexId)) {
    return { result: 'DENIED', message: 'Hex already owned.' };
  }

  // Roll for contested claim (37.5% = 3 in 8)
  const roll = Math.random();
  
  if (roll < 0.375) {
    // Contested - NPC also wants this land
    const factions = ['The Baron', 'Wandering Tribe', 'Merchant Guild', 'Old Faith'];
    const contestedBy = factions[Math.floor(Math.random() * factions.length)];
    
    return {
      result: 'CONTESTED',
      contestedBy,
      message: `Claim contested by ${contestedBy}! Dispute required.`
    };
  }

  // Success - claim the hex
  const newHex = createOwnedHex(hexId, terrain, tags);
  
  return {
    result: 'SUCCESS',
    newHex,
    message: `Successfully claimed hex ${hexId}.`
  };
}

/**
 * Check if player can dispute a contested claim
 */
export function canDisputeClaim(state: RealmState, contestedBy: string): { 
  canDispute: boolean; 
  requirements: DisputeRequirements;
  reason?: string;
} {
  const requirements: DisputeRequirements = {
    rings: contestedBy === 'The Baron' ? 100 : 50,
    population: contestedBy === 'Wandering Tribe' ? 10 : 5,
    titles: contestedBy === 'Merchant Guild' ? ['FOUNDER'] : []
  };

  if (state.rings < requirements.rings) {
    return { 
      canDispute: false, 
      requirements,
      reason: `Need ${requirements.rings} Rings to dispute.`
    };
  }

  if (state.population.total < requirements.population) {
    return { 
      canDispute: false, 
      requirements,
      reason: `Need ${requirements.population} population to dispute.`
    };
  }

  for (const title of requirements.titles) {
    if (!state.titles.includes(title as any)) {
      return { 
        canDispute: false, 
        requirements,
        reason: `Need ${title} title to dispute.`
      };
    }
  }

  return { canDispute: true, requirements };
}
