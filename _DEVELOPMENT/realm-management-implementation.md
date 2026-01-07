# Realm Management — Implementation Plan

*Data structures, state management, and UI integration for the Realm Management screen.*

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Schemas](#data-schemas)
3. [Zustand Store Structure](#zustand-store-structure)
4. [Tab-by-Tab Implementation](#tab-by-tab-implementation)
5. [Persistence Strategy](#persistence-strategy)
6. [Implementation Order](#implementation-order)
7. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

### Why Zustand?

- **Lightweight** — minimal boilerplate
- **Persistent** — built-in middleware for localStorage/file export
- **Sliceable** — can split into logical domains
- **Reactive** — components auto-update on state change
- **TypeScript-friendly** — excellent type inference

### Folder Structure

```
/src/
├── stores/
│   └── realm/
│       ├── index.ts              # Combined store export
│       ├── types.ts              # All TypeScript interfaces
│       ├── slices/
│       │   ├── characterSlice.ts # Character tab data
│       │   ├── ledgerSlice.ts    # Realm Ledger tab data
│       │   ├── buildingsSlice.ts # Buildings + Houses & Manors
│       │   ├── landSlice.ts      # Claimed + Unclaimed land
│       │   └── worldSlice.ts     # World-level data (gods, aspects, etc.)
│       └── utils/
│           ├── saveLoad.ts       # Save/load to JSON file
│           ├── migrations.ts     # Handle version upgrades
│           └── calculations.ts   # Derived values (total income, etc.)
│
├── data/
│   └── static/
│       ├── buildings.json        # Building definitions (already exists)
│       ├── tags.json             # Tag definitions (already exists)
│       ├── aspects.json          # Aspect definitions
│       └── titles.json           # Title progression definitions
```

---

## Data Schemas

### Master Types File (`types.ts`)

```typescript
// ============================================
// CORE TYPES
// ============================================

export interface RealmSaveData {
  version: string;                    // Save file version for migrations
  timestamp: number;                  // Last save timestamp
  character: CharacterData;
  ledger: LedgerData;
  buildings: BuildingInstance[];
  houses: HousingInstance[];
  claimedLand: ClaimedPlot[];
  unclaimedLand: UnclaimedPlot[];
  world: WorldData;
}

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
```

---

## Zustand Store Structure

### Main Store (`index.ts`)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { createCharacterSlice, CharacterSlice } from './slices/characterSlice';
import { createLedgerSlice, LedgerSlice } from './slices/ledgerSlice';
import { createBuildingsSlice, BuildingsSlice } from './slices/buildingsSlice';
import { createLandSlice, LandSlice } from './slices/landSlice';
import { createWorldSlice, WorldSlice } from './slices/worldSlice';

export type RealmStore = 
  CharacterSlice & 
  LedgerSlice & 
  BuildingsSlice & 
  LandSlice & 
  WorldSlice & {
    // Meta actions
    saveGame: () => RealmSaveData;
    loadGame: (data: RealmSaveData) => void;
    newGame: (worldSeed?: string) => void;
    getVersion: () => string;
  };

export const useRealmStore = create<RealmStore>()(
  persist(
    immer((set, get, api) => ({
      ...createCharacterSlice(set, get, api),
      ...createLedgerSlice(set, get, api),
      ...createBuildingsSlice(set, get, api),
      ...createLandSlice(set, get, api),
      ...createWorldSlice(set, get, api),
      
      saveGame: () => {
        const state = get();
        return {
          version: '1.0.0',
          timestamp: Date.now(),
          character: state.character,
          ledger: state.ledger,
          buildings: state.buildings,
          houses: state.houses,
          claimedLand: state.claimedLand,
          unclaimedLand: state.unclaimedLand,
          world: state.world,
        };
      },
      
      loadGame: (data) => {
        set((state) => {
          // Validate and migrate if needed
          const migrated = migrateIfNeeded(data);
          Object.assign(state, migrated);
        });
      },
      
      newGame: (worldSeed) => {
        set((state) => {
          Object.assign(state, createInitialState(worldSeed));
        });
      },
      
      getVersion: () => '1.0.0',
    })),
    {
      name: 'ruins-and-realms-save',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist actual game data, not UI state
        character: state.character,
        ledger: state.ledger,
        buildings: state.buildings,
        houses: state.houses,
        claimedLand: state.claimedLand,
        unclaimedLand: state.unclaimedLand,
        world: state.world,
      }),
    }
  )
);
```

### Example Slice (`buildingsSlice.ts`)

```typescript
import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { BuildingInstance, HousingInstance } from '../types';

export interface BuildingsSlice {
  buildings: BuildingInstance[];
  houses: HousingInstance[];
  
  // Actions
  addBuilding: (building: Omit<BuildingInstance, 'instanceId'>) => string;
  removeBuilding: (instanceId: string) => void;
  updateBuilding: (instanceId: string, updates: Partial<BuildingInstance>) => void;
  damageBuilding: (instanceId: string, damage: number) => void;
  repairBuilding: (instanceId: string, amount: number) => void;
  upgradeBuilding: (instanceId: string) => boolean;
  allocateWorkers: (instanceId: string, count: number) => void;
  
  // Computed
  getTotalBuildingIncome: () => number;
  getBuildingsByPlot: (plotTag: string) => BuildingInstance[];
  getOperationalBuildings: () => BuildingInstance[];
  getBuildingsProvidingTag: (tag: string) => BuildingInstance[];
  getTotalPopulationCapacity: () => number;
  getTotalWorkers: () => number;
  getAvailableWorkers: () => number;
}

export const createBuildingsSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  BuildingsSlice
> = (set, get) => ({
  buildings: [],
  houses: [],
  
  addBuilding: (building) => {
    const instanceId = `bld_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set((state) => {
      const newBuilding: BuildingInstance = {
        ...building,
        instanceId,
      };
      
      // Check if it's housing
      if (building.buildingId === 'house' || 
          building.buildingId === 'shack' || 
          building.buildingId === 'manor') {
        state.houses.push(newBuilding as HousingInstance);
      } else {
        state.buildings.push(newBuilding);
      }
    });
    return instanceId;
  },
  
  removeBuilding: (instanceId) => {
    set((state) => {
      state.buildings = state.buildings.filter(b => b.instanceId !== instanceId);
      state.houses = state.houses.filter(h => h.instanceId !== instanceId);
    });
  },
  
  updateBuilding: (instanceId, updates) => {
    set((state) => {
      const building = state.buildings.find(b => b.instanceId === instanceId);
      if (building) {
        Object.assign(building, updates);
      }
      const house = state.houses.find(h => h.instanceId === instanceId);
      if (house) {
        Object.assign(house, updates);
      }
    });
  },
  
  damageBuilding: (instanceId, damage) => {
    set((state) => {
      const building = [...state.buildings, ...state.houses]
        .find(b => b.instanceId === instanceId);
      if (building) {
        building.hp.current = Math.max(0, building.hp.current - damage);
        building.damaged = building.hp.current < building.hp.max * 0.5;
        if (building.hp.current === 0) {
          building.operational = false;
        }
      }
    });
  },
  
  repairBuilding: (instanceId, amount) => {
    set((state) => {
      const building = [...state.buildings, ...state.houses]
        .find(b => b.instanceId === instanceId);
      if (building) {
        building.hp.current = Math.min(building.hp.max, building.hp.current + amount);
        building.damaged = building.hp.current < building.hp.max * 0.5;
      }
    });
  },
  
  upgradeBuilding: (instanceId) => {
    const state = get();
    const building = [...state.buildings, ...state.houses]
      .find(b => b.instanceId === instanceId);
    
    if (!building) return false;
    
    // Check if upgrade is available (would need to reference buildings.json)
    // For now, just increment level
    set((s) => {
      const b = [...s.buildings, ...s.houses].find(x => x.instanceId === instanceId);
      if (b) {
        b.level += 1;
        // Apply upgrade bonuses from buildings.json
      }
    });
    
    return true;
  },
  
  allocateWorkers: (instanceId, count) => {
    set((state) => {
      const building = state.buildings.find(b => b.instanceId === instanceId);
      if (building) {
        building.workers.allocated = Math.min(count, building.workers.required);
        building.operational = building.workers.allocated >= building.workers.required;
      }
    });
  },
  
  // Computed values
  getTotalBuildingIncome: () => {
    const state = get();
    return state.buildings
      .filter(b => b.operational)
      .reduce((sum, b) => sum + b.income, 0);
  },
  
  getBuildingsByPlot: (plotTag) => {
    const state = get();
    return [...state.buildings, ...state.houses]
      .filter(b => b.plotTag === plotTag);
  },
  
  getOperationalBuildings: () => {
    return get().buildings.filter(b => b.operational);
  },
  
  getBuildingsProvidingTag: (tag) => {
    return get().buildings.filter(b => b.providedTags.includes(tag));
  },
  
  getTotalPopulationCapacity: () => {
    return get().houses.reduce((sum, h) => sum + (h.capacity || 0), 0);
  },
  
  getTotalWorkers: () => {
    return get().houses.reduce((sum, h) => sum + (h.occupants || 0), 0);
  },
  
  getAvailableWorkers: () => {
    const state = get();
    const totalWorkers = state.houses.reduce((sum, h) => sum + (h.occupants || 0), 0);
    const allocatedWorkers = state.buildings.reduce(
      (sum, b) => sum + b.workers.allocated, 0
    );
    return totalWorkers - allocatedWorkers;
  },
});
```

---

## Tab-by-Tab Implementation

### Tab 1: Character

**Data Source:** `characterSlice`

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────┐
│ CHARACTER SHEET                                             │
├─────────────────────────────────────────────────────────────┤
│ Name: [__________]                          Level: [__]     │
│                                                             │
│ HEALTH POINTS: [====████████====] 18/20                     │
│ XP: [============████░░░░░░░░░░] 450/1000                   │
│                                                             │
│ SHIFT: [+2]    DISCIPLINE: [+1]    PRECISION: [+0]          │
│                                                             │
│ WEAPON: Longsword              APPLIED RUNES: Fire, Sharp   │
├─────────────────────────────────────────────────────────────┤
│ MANOEUVRES                    DICE SET        MODIFIER      │
│ ├── Guard Strike              [4,4]           D8            │
│ ├── Shield Bash               [3,6]           D8, -1 Shift  │
│ └── Measured Thrust           [5,4]           D8            │
├─────────────────────────────────────────────────────────────┤
│ ARMOUR PIECE                  DICE SET        MODIFIER      │
│ ├── Padded Tunic              [5]             -1 damage     │
│ └── Wooden Shield             [6,5]           -2 damage     │
├─────────────────────────────────────────────────────────────┤
│ MAGIC SCROLLS     ORBIT    DISPEL DBL    EFFECT MODIFIER   │
│ └── Scroll of Balance  [2]     [✓]        +1 Discipline    │
├─────────────────────────────────────────────────────────────┤
│ MAGIC POTIONS                              EFFECT MODIFIER  │
│ └── Potion of Healing (x2)                 Restore 10 HP   │
├─────────────────────────────────────────────────────────────┤
│ STATUS                                                      │
│ [░] BLOODIED - Fever: -1 HP per room until washed          │
│ [░] SOAKED - Pneumonia: -1 HP per room until heated        │
├─────────────────────────────────────────────────────────────┤
│ COINS          │ TREASURE                                   │
│ GC: 12         │ Silver Ring (15gc)                        │
│ SC: 45         │ Ruby (MQ) (24gc)                          │
│ CC: 120        │                                            │
├─────────────────────────────────────────────────────────────┤
│ LIBERATED PRISONERS          │ SIDE QUESTS                  │
│ ├── Kael the Smith           │ ├── [✓] Find the Lost Tome  │
│ └── Mira the Scout           │ └── [░] Clear the Old Mine  │
├─────────────────────────────────────────────────────────────┤
│ FAVOUR OF THE GODS                          FAVOUR POINTS   │
│ ├── [God Name] the [Title]                  ███░░ 3        │
│ └── [God Name] the [Title]                  █░░░░ 1        │
├─────────────────────────────────────────────────────────────┤
│ LEGEND STATUS: [1][2][3][░][░][░][░][░][░][░]              │
└─────────────────────────────────────────────────────────────┘

PAGE 2:
┌─────────────────────────────────────────────────────────────┐
│ LARGE AND HEAVY ITEMS (10 max)  │ SMALL ITEMS               │
│ 1. Rope (50ft)                  │ Flint and steel           │
│ 2. Iron Pot                     │ Chalk (5 pieces)          │
│ 3. _______________              │ Lockpicks                 │
│ ...                             │ Mirror (small)            │
│ 10. ______________              │ ...                       │
├─────────────────────────────────┼─────────────────────────────┤
│ ADDITIONAL NOTES                │ LOOT LOCKUP               │
│                                 │ • Skeleton: Bone fragments│
│                                 │ • Ghoul: 12 SC, Ring      │
│                                 │                           │
├─────────────────────────────────┴─────────────────────────────┤
│ RATIONS: [████████░░] 8/10                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Tab 2: Realm Ledger

**Data Source:** `ledgerSlice`

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────┐
│ REALM LEDGER                                                │
├─────────────────────────────────────────────────────────────┤
│ Year │   GC   │   SC   │  GEMS  │ TOTAL INCOME             │
│  837 │   45   │  230   │   3    │    92 GC                 │
│  838 │   52   │  180   │   5    │   104 GC                 │
│                                                             │
│ Building Register Income: 47 GC                             │
│ High Actuary Roll Modifiers: +5% (Market), -2% (Damaged Mill)│
├─────────────────────────────────────────────────────────────┤
│ WELLNESS                    │ TEMP WELLNESS                 │
│ POSITIVE (Decor/Improve)    │ NEGATIVE (Eyesores/Atrophy)   │
│ ├── Shrine: +1              │ ├── Damaged Palisade: -1      │
│ ├── Tavern: +1              │ └── Famine Event: -2 (3 turns)│
│ └── Monument: +2            │                               │
│                             │                               │
│ TOTAL: +4                   │ TOTAL: -3         NET: +1     │
├─────────────────────────────────────────────────────────────┤
│ ASPECT INFLUENCE                                            │
│ ├── [Aspect Name]: Influence +3                             │
│ │   └── Effects: +1 to combat rolls, Undead more common     │
│ ├── [Aspect Name]: Influence -2                             │
│ │   └── Effects: Crops grow slower                          │
│ └── [Aspect Name]: Influence 0 (Neutral)                    │
├─────────────────────────────────────────────────────────────┤
│ TITLE CLAIM AREA: Blackstone Vale     LANDOWNER TITLE: Lord │
│ Current Title: THANE                                        │
│ Claimed: [✓]SURVIVOR [✓]FOUNDER [✓]THANE [░]LORD [░]SOVEREIGN│
├─────────────────────────────────────────────────────────────┤
│ KALADEAR FAVOUR POINTS                                      │
│ [God 1]: ███░░  [God 2]: █░░░░  [God 3]: ░░░░░             │
├─────────────────────────────────────────────────────────────┤
│ LANDOWNERS                              GIFTS    THREATS    │
│ ├── Lord _______ _______                [  ]     [  ]       │
│ ├── Lady _______ _______                [  ]     [  ]       │
│ ├── Dignitary _______ _______           [  ]     [  ]       │
│ └── Governor _______ _______            [  ]     [  ]       │
└─────────────────────────────────────────────────────────────┘
```

---

### Tab 3: Buildings

**Data Source:** `buildingsSlice`

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ BUILDING REGISTER                                                    PAGE: 1/3 │
├──────────┬────────────────┬──────┬───────┬──────┬────────┬─────────┬───────────┤
│ PLOT TAG │ BUILDING TYPE  │ SIZE │ LEVEL │ RANK │ INCOME │ WORKERS │   HP      │
│          │                │ (BP) │       │ MOD  │        │ Req/All │  Cur/Max  │
├──────────┼────────────────┼──────┼───────┼──────┼────────┼─────────┼───────────┤
│ A1       │ Blacksmith     │  10  │   1   │  +5  │   3    │  2/2    │   6/6     │
│ A1       │ Well           │   5  │   1   │  +1  │   0    │  0/0    │   4/4     │
│ A2       │ Farmstead      │  50  │   2   │  +4  │   3    │  2/2    │   6/6     │
│ A2       │ Granary        │  15  │   1   │  +2  │   0    │  1/1    │  10/10    │
│ B1       │ Sawmill        │  20  │   1   │  +5  │   4    │  2/1    │   8/8  ⚠️ │
│ B2       │ Quarry         │  50  │   1   │  +4  │   3    │  3/3    │   5/8  🔨 │
├──────────┴────────────────┴──────┴───────┴──────┴────────┴─────────┴───────────┤
│ TAGS                                                                           │
├──────────┬─────────────────────────────────┬───────────────────────────────────┤
│ BUILDING │ REQUIRED TAGS                   │ PROVIDED TAGS                     │
├──────────┼─────────────────────────────────┼───────────────────────────────────┤
│ Blacksmith│ SMELTING                       │ SMITHING                          │
│ Sawmill  │ TIMBER, WATER                   │ WOODWORKING                       │
│ Quarry   │ STONE                           │ (none)                            │
│ Farmstead│ FERTILE                         │ (none)                            │
│ Granary  │ (requires: Farmstead)           │ (none)                            │
├──────────┴─────────────────────────────────┴───────────────────────────────────┤
│ SUMMARY                                                                        │
│ Total Buildings: 6    │ Operational: 5    │ Damaged: 1    │ Total Income: 13   │
│ Workers Required: 10  │ Workers Allocated: 9  │ Workers Available: 3           │
└─────────────────────────────────────────────────────────────────────────────────┘

Legend: ⚠️ = Understaffed (not operational)   🔨 = Damaged (<50% HP)
```

---

### Tab 4: Houses & Manors

**Data Source:** `buildingsSlice` (houses array)

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HOUSE AND MANOR BUILDING REGISTER                                    PAGE: 1/1 │
├──────────┬────────────────┬──────┬───────┬──────┬────────┬───────────┬─────────┤
│ PLOT TAG │ BUILDING TYPE  │ SIZE │ LEVEL │ RANK │ INCOME │ CAPACITY  │   HP    │
│          │                │ (BP) │       │ MOD  │        │  Pop/Max  │ Cur/Max │
├──────────┼────────────────┼──────┼───────┼──────┼────────┼───────────┼─────────┤
│ A1       │ Shack          │   5  │   1   │  +1  │   0    │   2/2     │   4/4   │
│ A1       │ Shack          │   5  │   1   │  +1  │   0    │   2/2     │   4/4   │
│ A1       │ House          │  10  │   1   │  +2  │   0    │   3/4     │   6/6   │
│ B1       │ House          │  10  │   2   │  +2  │   0    │   6/6     │   6/6   │
│ B2       │ Manor          │  15  │   1   │  +8  │   2    │   4/4     │   8/8   │
├──────────┴────────────────┴──────┴───────┴──────┴────────┴───────────┴─────────┤
│ WORKER ALLOCATION                                                              │
├──────────┬─────────────────────────────────────────────────────────────────────┤
│ HOUSING  │ WORKERS → ASSIGNED TO                                               │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ Shack #1 │ Worker 1 → Blacksmith, Worker 2 → Farmstead                         │
│ Shack #2 │ Worker 3 → Farmstead, Worker 4 → Granary                            │
│ House #1 │ Worker 5 → Sawmill, Worker 6 → (Unassigned), Worker 7 → (Unassigned)│
│ House #2 │ Worker 8-13 → Quarry (3), Manor (2), Unassigned (1)                 │
│ Manor    │ Worker 14-17 → Manor Staff (2), Unassigned (2)                      │
├──────────┴─────────────────────────────────────────────────────────────────────┤
│ POPULATION SUMMARY                                                             │
│ Total Capacity: 22   │ Current Population: 17   │ Available Housing: 5         │
│ Total Workers: 17    │ Assigned Workers: 14     │ Available Workers: 3         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Tab 5: Unclaimed Land Log

**Data Source:** `landSlice`

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UNCLAIMED LAND LOG                                                   PAGE: 1/2 │
├──────────┬──────────────┬──────┬──────┬───────────┬─────────────────┬──────────┤
│ PLOT/AREA│ LAND TYPE    │ SIZE │ RANK │ RANK MOD  │ OWNER/DETAILS   │ DISPUTE? │
│ TAG      │              │      │      │           │                 │          │
├──────────┼──────────────┼──────┼──────┼───────────┼─────────────────┼──────────┤
│ C1       │ Forest       │ 100  │  3   │    +0     │ Unclaimed       │ ✓ (2 adj)│
│ C2       │ Hills        │ 100  │  4   │    +1     │ Lord Blackstone │ ✓ (2 adj)│
│ D1       │ Meadow       │ 100  │  3   │    +0     │ Unclaimed       │ ✗ (1 adj)│
│ D2       │ Swamp        │ 100  │  2   │    -1     │ Unclaimed       │ ✗ (0 adj)│
│ E1       │ Mountains    │ 100  │  5   │    +2     │ Dignitary Moor  │ ✗ (0 adj)│
├──────────┴──────────────┴──────┴──────┴───────────┴─────────────────┴──────────┤
│ TAGS PROVIDED                                                                  │
├──────────┬──────────────────────────────────────────────────────────────────────┤
│ C1       │ TIMBER, GAME, HERBS                                                 │
│ C2       │ STONE, ORE                                                         │
│ D1       │ FERTILE, WATER                                                     │
│ D2       │ PEAT, WATER, HERBS                                                 │
│ E1       │ STONE, ORE, DEEP_ORE                                               │
├──────────┴──────────────────────────────────────────────────────────────────────┤
│ [Click row to view on map]                          [Filter: Disputable Only] │
└─────────────────────────────────────────────────────────────────────────────────┘

Legend: 
✓ (2 adj) = Can dispute (2 of your plots are adjacent)
✗ (1 adj) = Cannot dispute yet (need 2 adjacent)
✗ (0 adj) = Not adjacent to your territory
```

---

### Tab 6: Claimed Land Log

**Data Source:** `landSlice`

**UI Sections:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAND LOG (CLAIMED)                                                   PAGE: 1/1 │
├──────────┬──────────────┬──────┬───────┬──────────┬──────────┬─────────────────┤
│ PLOT/AREA│ LAND TYPE    │ SIZE │ RANK  │ +RANK MOD│ =TAXES   │ BUILDING POINTS │
│ TAG      │              │      │ (base)│(buildings)│ (in SC) │   Used / Total  │
├──────────┼──────────────┼──────┼───────┼──────────┼──────────┼─────────────────┤
│ A1       │ Meadow       │ 100  │   3   │   +12    │   15 SC  │    65 / 100     │
│ A2       │ Forest Edge  │ 100  │   3   │    +6    │    9 SC  │    65 / 100     │
│ B1       │ Riverbank    │ 100  │   4   │    +5    │    9 SC  │    30 / 100     │
│ B2       │ Hills        │ 100  │   4   │    +4    │    8 SC  │    50 / 100     │
├──────────┴──────────────┴──────┴───────┴──────────┴──────────┴─────────────────┤
│ DETAILS                                                                        │
├──────────┬──────────────────────────────────────────────────────────────────────┤
│ A1       │ Settlement center. Blacksmith, Well, 2× Shack, House.               │
│          │ Tags: FERTILE, WATER (from Well)                                    │
│          │ Adjacent unclaimed: C1 (disputeable)                                │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ A2       │ Farm district. Farmstead, Granary.                                  │
│          │ Tags: FERTILE, TIMBER                                               │
│          │ Adjacent unclaimed: C1, C2 (both disputeable)                       │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ B1       │ Industry. Sawmill, House.                                           │
│          │ Tags: TIMBER, WATER                                                 │
│          │ Adjacent unclaimed: D1                                              │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ B2       │ Extraction. Quarry, Manor.                                          │
│          │ Tags: STONE, ORE                                                    │
│          │ Adjacent unclaimed: D1, D2, E1                                      │
├──────────┴──────────────────────────────────────────────────────────────────────┤
│ TOTALS                                                                         │
│ Total Claimed Plots: 4   │ Total Taxes: 41 SC   │ Total BP: 210/400 (52.5%)   │
│ [Click row to view on map]                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Persistence Strategy

### Auto-Save (localStorage)

The Zustand `persist` middleware handles this automatically:

```typescript
// Saves to localStorage on every state change
// Key: 'ruins-and-realms-save'
// Automatically loads on app start
```

### Manual Save/Load (File Export)

```typescript
// utils/saveLoad.ts

export const exportSaveFile = (store: RealmStore): void => {
  const saveData = store.saveGame();
  const blob = new Blob(
    [JSON.stringify(saveData, null, 2)], 
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ruins-and-realms-${saveData.world.name}-${saveData.timestamp}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};

export const importSaveFile = async (
  file: File, 
  store: RealmStore
): Promise<boolean> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as RealmSaveData;
    
    // Validate
    if (!data.version || !data.character || !data.world) {
      throw new Error('Invalid save file format');
    }
    
    store.loadGame(data);
    return true;
  } catch (error) {
    console.error('Failed to load save file:', error);
    return false;
  }
};
```

### Version Migration

```typescript
// utils/migrations.ts

export const migrateIfNeeded = (data: RealmSaveData): RealmSaveData => {
  const currentVersion = '1.0.0';
  
  if (data.version === currentVersion) {
    return data;
  }
  
  // Apply migrations in order
  let migrated = data;
  
  if (compareVersions(data.version, '0.1.0') < 0) {
    migrated = migrate_0_1_0(migrated);
  }
  
  if (compareVersions(data.version, '1.0.0') < 0) {
    migrated = migrate_1_0_0(migrated);
  }
  
  migrated.version = currentVersion;
  return migrated;
};

const migrate_1_0_0 = (data: any): RealmSaveData => {
  // Example: Add new fields that didn't exist before
  return {
    ...data,
    ledger: {
      ...data.ledger,
      aspectInfluence: data.ledger.aspectInfluence || [],
    },
  };
};
```

---

## Implementation Order

### Phase 1: Core Structure (Foundation)
1. Create `/stores/realm/types.ts` with all interfaces
2. Create `/stores/realm/index.ts` with basic store setup
3. Create `worldSlice.ts` (needed for everything else)
4. Set up persistence middleware

### Phase 2: Character Tab
5. Create `characterSlice.ts`
6. Build Character tab UI components
7. Connect to existing combat system

### Phase 3: Land Management
8. Create `landSlice.ts`
9. Build Unclaimed Land Log tab
10. Build Claimed Land Log tab
11. Connect to hex map (click to view)

### Phase 4: Buildings
12. Create `buildingsSlice.ts`
13. Build Buildings tab UI
14. Build Houses & Manors tab UI
15. Connect building placement to land

### Phase 5: Realm Ledger
16. Create `ledgerSlice.ts`
17. Build Realm Ledger tab UI
18. Implement income calculations
19. Connect Aspect system

### Phase 6: Polish
20. Implement file save/load
21. Add migrations system
22. QoL features (map links, filters, sorting)

---

## Future Enhancements

### QoL Features (mentioned by T)
- [ ] Unclaimed Land: Show disputability status
- [ ] Unclaimed Land: "2 of OUR plots adjacent" indicator
- [ ] All Land: Click to jump to map location
- [ ] All Land: Show provided tags
- [ ] Buildings: Filter by operational/damaged
- [ ] Buildings: Sort by income/workers/HP

### Additional Features
- [ ] Undo/Redo for state changes
- [ ] Multiple save slots
- [ ] Cloud sync (future)
- [ ] Export to printable PDF (character sheet)
- [ ] Import from 2D6 Dungeon character sheets?

---

## Integration Points

### Existing Systems to Connect

| System | Integration |
|--------|-------------|
| Hex Map | Land plots reference hex coordinates |
| Combat | Character stats used in combat |
| Phase Wheel | Current phase stored in world state |
| Buildings JSON | Building instances reference definitions |
| Tags JSON | Tags referenced throughout |

### Events That Trigger State Updates

| Event | State Changes |
|-------|---------------|
| Combat ends | XP, HP, loot, conditions |
| Building placed | Buildings array, land BP |
| Building damaged | Building HP |
| Turn advances | Income calculated, conditions tick |
| Land claimed | Move from unclaimed to claimed |
| Worker assigned | Building operational status |

---

*Document Version: 1.0.0*
*Last Updated: 2026-01-06*
*Author: Design Seren*
