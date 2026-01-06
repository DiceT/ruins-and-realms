import { RealmState, TitleId } from '../types/realmTypes';

/**
 * TITLE PROGRESSION (Addendum 011)
 * Checks if player qualifies for new titles based on achievements
 */

export interface TitleResult {
  newTitles: TitleId[];
  log: string[];
}

// Helper to count cleared domains (placeholder - will need actual domain tracking)
function countClearedDomains(state: RealmState): number {
  // Future: Track domains separately
  // For now, count UNQUIET clocks that reached max (cleared)
  return 0;
}

/**
 * Check if player qualifies for any new titles
 */
export function checkTitleEligibility(state: RealmState): TitleResult {
  const newTitles: TitleId[] = [];
  const log: string[] = [];
  const currentTitles = state.titles;
  
  // FOUNDER: 3 hexes + Pop 8+
  if (!currentTitles.includes('FOUNDER')) {
    if (state.ownedHexes.length >= 3 && state.population.total >= 8) {
      newTitles.push('FOUNDER');
      log.push('🎖️ TITLE EARNED: FOUNDER! The realm recognizes your leadership.');
    }
  }
  
  // THANE: Pop 15+ + Manor + 1 Domain cleared
  if (!currentTitles.includes('THANE')) {
    const hasManor = state.buildings.some(b => b.defId === 'manor' && b.isBuilt);
    const domainsCleared = countClearedDomains(state);
    if (state.population.total >= 15 && hasManor && domainsCleared >= 1) {
      newTitles.push('THANE');
      log.push('🎖️ TITLE EARNED: THANE! Your authority is unquestioned.');
    }
  }
  
  // LORD: Rank 8 Domain + Guild Hall + Pop 25+
  if (!currentTitles.includes('LORD')) {
    const hasGuildHall = state.buildings.some(b => b.defId === 'guild_hall' && b.isBuilt);
    // Future: Check for rank 8 domain cleared
    const hasRank8 = false;
    if (state.population.total >= 25 && hasGuildHall && hasRank8) {
      newTitles.push('LORD');
      log.push('🎖️ TITLE EARNED: LORD! You rule a true domain.');
    }
  }
  
  // WARDEN: 3 Domains + DEFENSE + TRAINING tags
  if (!currentTitles.includes('WARDEN')) {
    const allTags = state.ownedHexes.flatMap(h => h.landTags);
    const hasDefense = allTags.includes('DEFENSE') || 
      state.buildings.some(b => b.isBuilt && ['barracks', 'watchtower', 'fortress'].includes(b.defId));
    const hasTraining = state.buildings.some(b => b.isBuilt && b.defId === 'training_yard');
    const domainsCleared = countClearedDomains(state);
    
    if (domainsCleared >= 3 && hasDefense && hasTraining) {
      newTitles.push('WARDEN');
      log.push('🎖️ TITLE EARNED: WARDEN! Guardian of the realm.');
    }
  }
  
  // SAGE: LEARNING + SCRIBING + Ancient Ruin
  if (!currentTitles.includes('SAGE')) {
    const hasLibrary = state.buildings.some(b => b.isBuilt && b.defId === 'library');
    const hasScriptorium = state.buildings.some(b => b.isBuilt && b.defId === 'scriptorium');
    // Future: Check for ancient ruin cleared
    
    if (hasLibrary && hasScriptorium) {
      newTitles.push('SAGE');
      log.push('🎖️ TITLE EARNED: SAGE! Knowledge is your domain.');
    }
  }
  
  // HIGH_PRIEST: SACRED + Temple + Temple Domain
  if (!currentTitles.includes('HIGH_PRIEST')) {
    const hasTemple = state.buildings.some(b => b.isBuilt && b.defId === 'temple');
    // Future: Check for temple domain cleared
    
    if (hasTemple) {
      // Simplified check for now
      // newTitles.push('HIGH_PRIEST');
      // log.push('🎖️ TITLE EARNED: HIGH PRIEST! Divine favor is yours.');
    }
  }
  
  return { newTitles, log };
}

/**
 * Process title progression during Dawn phase
 * Returns updated titles array and logs
 */
export function processTitleProgression(state: RealmState): TitleResult {
  const { newTitles, log } = checkTitleEligibility(state);
  
  return {
    newTitles: [...state.titles, ...newTitles],
    log
  };
}
