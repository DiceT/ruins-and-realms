import { BuildingInstance } from '../../types/realmTypes';
import { getBuildingDef } from '../../utils/buildingRegistry';

/**
 * START CONSTRUCTION
 * Creates a new BuildingInstance record.
 * Does NOT deduct costs (that's handled by the Store/Action dispatch).
 */
export function startConstruction(defId: string, hexId: string): BuildingInstance {
  const def = getBuildingDef(defId);
  if (!def) throw new Error(`Invalid Building Definition ID: ${defId}`);

  return {
    id: crypto.randomUUID(), // Unique ID
    defId: defId,
    hexId: hexId,
    constructionPoints: 0,
    isBuilt: false
  };
}

/**
 * GET CONSTRUCTION TARGET
 * Helper to know how many points are needed.
 */
export function getConstructionTarget(defId: string): number {
  const def = getBuildingDef(defId);
  return def ? def.construction : 999;
}
