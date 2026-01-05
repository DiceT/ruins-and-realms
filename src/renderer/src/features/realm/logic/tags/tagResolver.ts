import { RealmState } from '../../types/realmTypes';
import { TagId } from '../../data/schemas';
import { getBuildingDef } from '../../utils/buildingRegistry';

/**
 * RESOLVE AVAILABLE TAGS
 * Aggregates all active tags from:
 * 1. Owned Land (Resources like TIMBER, STONE)
 * 2. Constructed Buildings (Infrastructure like MASONRY, SMITHING)
 */
export function resolveAvailableTags(state: RealmState): TagId[] {
  const activeTags = new Set<TagId>();

  // 1. Scan Owned Land
  state.ownedHexes.forEach(hex => {
    hex.landTags.forEach(tag => activeTags.add(tag));
  });

  // 2. Scan Constructed Buildings
  state.buildings.forEach(b => {
    if (!b.isBuilt) return;

    const def = getBuildingDef(b.defId);
    if (def && def.grants && def.grants.tags) {
      def.grants.tags.forEach(tag => activeTags.add(tag));
    }
  });

  return Array.from(activeTags);
}
