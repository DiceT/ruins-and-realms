export interface RealmSaveData {
  version: string;                    // Save file version for migrations
  timestamp: number;                  // Last save timestamp
  // character: CharacterData;        // Commented out until CharacterData is fully defined
  // ledger: LedgerData;              // Commented out until LedgerData is fully defined
  // buildings: BuildingInstance[];   // Commented out until BuildingInstance is fully defined
  // houses: HousingInstance[];       // Commented out until HousingInstance is fully defined
  // claimedLand: ClaimedPlot[];      // Commented out until ClaimedPlot is fully defined
  // unclaimedLand: UnclaimedPlot[];  // Commented out until UnclaimedPlot is fully defined
  world: WorldData;
}

// ============================================
// CORE TYPES
// ============================================

// ... (Will populate with full types from the plan)

// ============================================
// CHARACTER TAB
// ============================================

export interface CharacterData {
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  
  // Core Stats
  healthPoints: {
    current: number;
    max: number;
  };
  shift: number;
  discipline: number;
  precision: number;
  
  // Combat
  weapon: string;                     // Weapon type ID
  appliedRunes: string[];             // Rune IDs applied to weapon
  manoeuvres: EquippedManoeuvre[];
  armour: ArmourPiece[];
  
  // Magic
  magicScrolls: MagicScroll[];
  magicPotions: MagicPotion[];
  
  // Status
  bloodied: boolean;
  soaked: boolean;
  conditions: Condition[];
  
  // Inventory
  coins: {
    gold: number;                     // GC
    silver: number;                   // SC
    copper: number;                   // CC
  };
  gems: Gem[];
  largeItems: InventoryItem[];        // Max 10
  smallItems: InventoryItem[];
  rations: number;
  treasure: TreasureItem[];
  
  // Progression
  liberatedPrisoners: string[];       // NPC IDs
  sideQuests: SideQuest[];
  legendStatusLevel: number;          // 1-10 dungeon levels completed
  
  // Divine
  favourPoints: GodFavour[];          // God ID -> favour points
  
  // Loot
  lootLockup: LootEntry[];            // Pending loot to process
}

export interface EquippedManoeuvre {
  id: string;
  name: string;
  dice: [number, number];
  damage: string;
  effect?: string;
}

export interface ArmourPiece {
  id: string;
  name: string;
  diceSet: number[];                  // Blocking dice values
  modifier: number;                   // Damage reduction
  slot: 'head' | 'body' | 'hands' | 'shield' | 'accessory';
}

export interface MagicScroll {
  id: string;
  name: string;
  orbit: number;                      // Usage tracking
  dispelDoubles: boolean;
  effectModifier: string;
}

export interface MagicPotion {
  id: string;
  name: string;
  effectModifier: string;
  quantity: number;
}

export interface Condition {
  id: string;
  name: string;
  effect: string;
  duration?: number;                  // Turns remaining, if temporary
}

export interface Gem {
  type: 'pearl' | 'sapphire' | 'garnet' | 'ruby' | 'emerald' | 'diamond';
  quality: 'low' | 'mid' | 'high';
  value: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  isHeavy?: boolean;                  // Counts toward 10-item limit
}

export interface TreasureItem {
  id: string;
  name: string;
  value: number;
  description?: string;
}

export interface SideQuest {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  completed: boolean;
  xpReward: number;
}

export interface QuestObjective {
  description: string;
  completed: boolean;
}

export interface GodFavour {
  godId: string;                      // Reference to world.gods
  points: number;
}

export interface LootEntry {
  source: string;                     // Where it came from
  items: string[];                    // Item IDs or descriptions
  processed: boolean;
}

// ============================================
// REALM LEDGER TAB
// ============================================

export interface LedgerData {
  year: number;
  
  // Income Tracking (by year)
  incomeHistory: YearlyIncome[];
  
  // Wellness
  wellness: {
    permanent: WellnessModifier[];    // From buildings, titles, etc.
    temporary: WellnessModifier[];    // From events, conditions
  };
  
  // Titles
  currentTitle: string;               // Title ID
  claimedTitles: string[];            // All earned title IDs
  titleClaimArea: string;             // Name of claimed area
  landownerTitle: string;             // e.g., "Lord", "Lady", "Governor"
  
  // Divine (Realm-level)
  kaladearFavourPoints: GodFavour[];
  
  // Aspect Influence (replaces Secrets/Legends)
  aspectInfluence: AspectInfluence[];
  
  // Landowners (NPCs who own land in your realm)
  landowners: Landowner[];
}

export interface YearlyIncome {
  year: number;
  gold: number;
  silver: number;
  gems: number;
  totalIncome: number;
  buildingIncome: number;             // Calculated from building registers
  highActuaryModifiers: string[];     // Notes on modifiers applied
}

export interface WellnessModifier {
  source: string;                     // Building ID, event, etc.
  value: number;                      // +/- modifier
  description: string;
  category: 'decor' | 'improvement' | 'eyesore' | 'atrophy' | 'event';
}

export interface AspectInfluence {
  aspectId: string;                   // Reference to aspect definition
  influence: number;                  // -10 to +10 scale?
  effects: string[];                  // Current active effects
  history: AspectEvent[];             // Log of aspect-related events
}

export interface AspectEvent {
  turn: number;
  description: string;
  influenceChange: number;
}

export interface Landowner {
  id: string;
  title: string;                      // "Lord", "Lady", "Dignitary", "Governor"
  firstName: string;
  lastName: string;
  gifts: string[];                    // Gifts given/received
  threats: string[];                  // Threats made
  relationship: number;               // -10 to +10
  ownedPlots: string[];               // Plot IDs they own
}

// ============================================
// BUILDINGS TAB
// ============================================

export interface BuildingInstance {
  instanceId: string;                 // Unique instance ID
  buildingId: string;                 // Reference to buildings.json
  plotTag: string;                    // Which plot it's on
  
  // Stats
  name: string;                       // Can be renamed
  level: number;                      // Upgrade level
  hp: {
    current: number;
    max: number;
  };
  size: number;                       // BP cost
  rankMod: number;
  income: number;
  workers: {
    required: number;
    allocated: number;
  };
  
  // Tags
  requiredTags: string[];             // Tags needed to build
  providedTags: string[];             // Tags this building grants
  
  // Status
  operational: boolean;               // Has required workers?
  damaged: boolean;                   // Below 50% HP?
  constructionProgress?: {
    turnsRemaining: number;
    turnsTotal: number;
  };
  
  // Notes
  notes: string;
}

// ============================================
// HOUSES & MANORS TAB
// ============================================

export interface HousingInstance extends BuildingInstance {
  // Housing-specific
  capacity: number;                   // Population capacity
  occupants: number;                  // Current occupants
  allocatedWorkers: WorkerAllocation[];
}

export interface WorkerAllocation {
  workerId: string;                   // NPC ID if named, or generic
  assignedTo?: string;                // Building instance ID
  skills: string[];
}

// ============================================
// LAND TABS
// ============================================

export interface BasePlot {
  plotTag: string;                    // Unique identifier (e.g., "A1", "hex_0_0")
  landType: string;                   // Terrain type
  size: number;                       // Hex size or plot size
  rank: number;                       // Base rank
  rankModifier: number;               // From buildings, etc.
  providedTags: string[];             // Natural tags (TIMBER, WATER, etc.)
  details: string;
  
  // Map Integration
  hexCoordinates?: {
    q: number;
    r: number;
  };
}

export interface UnclaimedPlot extends BasePlot {
  owner?: string;                     // Current owner (if any NPC)
  
  // QoL Features
  canDispute: boolean;                // 2+ adjacent claimed plots?
  adjacentClaimedPlots: string[];     // Which of our plots are adjacent
  distance: number;                   // Distance from nearest claimed
  threatLevel: number;                // Nearby threats
}

export interface ClaimedPlot extends BasePlot {
  claimedOn: number;                  // Turn/year claimed
  taxesInSilver: number;              // Calculated: size × rank + rankMod
  buildingPoints: {
    used: number;
    total: number;                    // Usually 100
  };
  buildings: string[];                // Building instance IDs on this plot
  
  // QoL Features
  adjacentUnclaimedPlots: string[];   // Expansion opportunities
}

// ============================================
// WORLD DATA
// ============================================

export interface WorldData {
  seed: string;                       // World generation seed
  name: string;                       // World/realm name
  
  // Gods (randomly generated per world)
  gods: God[];
  
  // Aspects
  activeAspects: ActiveAspect[];
  
  // Calendar
  currentTurn: number;
  currentPhase: string;
  currentYear: number;
  currentSeason: string;
  
  // Global state
  threatLevel: number;
  domainProgress: DomainProgress[];
}

export interface God {
  id: string;
  name: string;
  title: string;                      // "The Core", "The Murk", etc.
  domain: string;
  favouredOfferings: string[];
  blessingEffects: string[];
}

export interface ActiveAspect {
  aspectId: string;
  position: number;                   // Position on wheel
  influence: number;
  activeEffects: string[];
}

export interface DomainProgress {
  domainId: string;
  name: string;
  cleared: boolean;
  clearedOn?: number;
  threatContribution: number;
}
