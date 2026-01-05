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
    id: crypto.randomUUID(),
    defId: defId,
    hexId: hexId,
    currentHP: 1,           // Starts at 1 HP, builds toward maxHP
    maxHP: def.hp,          // From building definition
    isBuilt: false,
    isDisabled: true        // Not operational until built
  };
}

/**
 * GET CONSTRUCTION TARGET
 * Returns the HP required to complete construction (same as maxHP).
 */
export function getConstructionTarget(defId: string): number {
  const def = getBuildingDef(defId);
  return def ? def.hp : 999;
}
