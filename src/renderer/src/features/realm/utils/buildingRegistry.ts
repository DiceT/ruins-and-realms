import { BuildingDefinition } from '../data/schemas';
import rawData from '../../../data/tables/overworld/realm-buildings.json';

// Define the root structure of the JSON file
interface RealmBuildingsFile {
  meta: any;
  building_stats_key: any;
  buildings: Record<string, Record<string, BuildingDefinition>>;
}

const data = rawData as RealmBuildingsFile;
const buildingsRoot = data.buildings;

/**
 * Get Building Definition by ID (e.g., "farmstead")
 * Scans all categories in realm-buildings.json
 */
export const getBuildingDef = (defId: string): BuildingDefinition | undefined => {
  // 1. Iterate Categories (agricultural, industrial, etc.)
  for (const categoryKey in buildingsRoot) {
    const category = buildingsRoot[categoryKey];
    
    // 2. Direct lookup (if the ID matched the key, which it usually doesn't "11" vs "farmstead")
    if (category[defId]) return category[defId];

    // 3. Value scan
    // The keys are "11", "12", but properties are { id: "farmstead", ... }
    const found = Object.values(category).find(b => b.id === defId);
    if (found) return found;
  }
  return undefined;
};
