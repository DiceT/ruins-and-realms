# Ruins & Realms: Realm System Addendums

## Document v0.1.0 — Consolidated Refinements

---

## Overview

This document consolidates all refinements, corrections, and additions to the base Realm System design following code review and reference material analysis. These addendums should be applied to bring the implementation in line with the complete vision.

---

## UI Addendum: Phase Wheel

### Concept

A subtle, secondary wheel UI element that rotates through the phases of a day. Serves as both status indicator and thematic reinforcement.

```
┌─────────────────────────────────────────────────────────────┐
│                      PHASE WHEEL                            │
│                                                             │
│              The Wheel of Fate speaks destiny.              │
│              The Phase Wheel speaks rhythm.                 │
└─────────────────────────────────────────────────────────────┘

                        ☀️ DAWN
                      ╱         ╲
                   🌅              🌄
                MORNING          MIDDAY
                   │                │
                   🌆              🌇
                 DUSK            NIGHT
                      ╲         ╱
                        🌙

- Smaller than the Fate Wheel
- Positioned as UI panel header or corner element
- Rotates smoothly as phases advance
- Current phase highlighted/enlarged
- Subtle ambient glow matching time of day
```

### Visual States

| Phase | Icon | Color Accent | Description |
|-------|------|--------------|-------------|
| DAWN | ☀️ | Soft gold | "The realm stirs" |
| MORNING | 🌅 | Warm orange | "Commerce awakens" |
| MIDDAY | 🌄 | Bright yellow | "Actions available" (player control) |
| DUSK | 🌆 | Purple/amber | "Events unfold" |
| NIGHT | 🌙 | Deep blue | "The realm sleeps" |

### Behavior

- Rotates clockwise as turn progresses
- During MIDDAY, wheel pulses subtly (player's turn)
- Quick transitions during automated phases
- Pauses and highlights during significant events
- Optional: Soft ticking sound as it rotates

---

## Addendum 001: Building HP Unification

### Problem

Current implementation separates construction progress (`constructionPoints`) from building health. After completion, there's no way to track damage.

### Solution

Unify into a single `currentHP` field that serves both purposes.

### Type Changes

```typescript
// OLD
export interface BuildingInstance {
  id: string;
  defId: string;
  hexId: string;
  constructionPoints: number; // Construction only
  isBuilt: boolean;
}

// NEW
export interface BuildingInstance {
  id: string;
  defId: string;
  hexId: string;
  currentHP: number;      // Unified: construction progress AND health
  maxHP: number;          // Cached from definition for quick access
  isBuilt: boolean;       // True when currentHP >= maxHP
  isDisabled: boolean;    // True when currentHP <= disabledThreshold
}
```

### Constants

```typescript
// Building is disabled when HP falls this far below max
// Example: Farm (HP 8) is disabled at 6 or below (8 - 2 = 6)
export const DISABLED_THRESHOLD_OFFSET = 2;

export function getDisabledThreshold(maxHP: number): number {
  return Math.max(1, maxHP - DISABLED_THRESHOLD_OFFSET);
}

export function isBuildingDisabled(currentHP: number, maxHP: number): boolean {
  return currentHP <= getDisabledThreshold(maxHP);
}
```

### Construction Flow

```typescript
// Start construction
const newBuilding: BuildingInstance = {
  id: crypto.randomUUID(),
  defId: defId,
  hexId: hexId,
  currentHP: 0,           // Starts at 0
  maxHP: def.hp,          // From definition
  isBuilt: false,
  isDisabled: true        // Not operational until built
};

// Each turn (Morning phase)
building.currentHP += 1;  // Base construction rate

if (building.currentHP >= building.maxHP) {
  building.isBuilt = true;
  building.isDisabled = false;
}
```

### Damage Flow

```typescript
// When threat damages a building
building.currentHP = Math.max(0, building.currentHP - damage);

// Check if disabled
if (building.currentHP <= getDisabledThreshold(building.maxHP)) {
  building.isDisabled = true;
  // Building still exists but doesn't function
  // No income, no tag grants, no food production
}

// If HP reaches 0
if (building.currentHP <= 0) {
  // Building is destroyed, remove from state
}
```

### REPAIR Action (Unified)

```typescript
// REPAIR works the same whether building is under construction or damaged
export function handleRepair(state: RealmState, payload: RepairActionPayload): ActionResult {
  const building = state.buildings.find(b => b.id === payload.buildingId);
  if (!building) {
    return { success: false, message: 'Building not found' };
  }
  
  // Add 1 HP (capped at max)
  const newHP = Math.min(building.maxHP, building.currentHP + 1);
  
  // Check if this repair completed construction or restored function
  const wasDisabled = building.isDisabled;
  const isNowBuilt = newHP >= building.maxHP;
  const isNowOperational = newHP > getDisabledThreshold(building.maxHP);
  
  // Update building
  const updatedBuilding = {
    ...building,
    currentHP: newHP,
    isBuilt: building.isBuilt || isNowBuilt,
    isDisabled: !isNowOperational
  };
  
  // Generate appropriate message
  let message = `Repaired ${building.defId} (+1 HP, now ${newHP}/${building.maxHP})`;
  if (!building.isBuilt && isNowBuilt) {
    message = `Construction complete: ${building.defId}!`;
  } else if (wasDisabled && isNowOperational) {
    message = `${building.defId} is operational again!`;
  }
  
  return {
    newState: {
      ...state,
      buildings: state.buildings.map(b => b.id === building.id ? updatedBuilding : b)
    },
    success: true,
    message
  };
}
```

---

## Addendum 002: State Additions

### Problem

Several systems reference state fields that don't exist yet.

### New Fields for RealmState

```typescript
export interface RealmState {
  // === EXISTING ===
  rings: RealmCurrency;
  population: RealmPopulation;
  wellness: RealmWellnessLevel;
  foodStatus: FoodStatus;
  date: RealmDate;
  buildings: BuildingInstance[];
  tax: { amount: number; daysUntilDue: number; status: 'PAID' | 'DUE' | 'OVERDUE' };
  baronPatience: number;
  phase: TurnPhase;
  ownedHexes: OwnedHex[];
  actionPoints: { current: number; max: number };
  
  // === NEW ===
  
  // Titles earned by player
  titles: TitleId[];
  
  // Threat tracking
  threat: number;  // Cumulative threat level (0+)
  
  // DELVE cooldown
  lastDelveTurn: number;  // Turn number of last DELVE (0 = never)
  
  // Clocks (future expansion)
  clocks: Clock[];
}

// Supporting types
export type TitleId = 'SURVIVOR' | 'FOUNDER' | 'THANE' | 'LORD' | 'WARDEN' | 'SAGE' | 'HIGH_PRIEST';

export interface Clock {
  id: string;
  name: string;
  type: 'AFFLICTION' | 'UNQUIET' | 'BARON' | 'CUSTOM';
  segments: number;      // Total segments (usually 4)
  filled: number;        // Currently filled
  sourceId?: string;     // Related hex, domain, or aspect
}
```

### Updated Initial State

```typescript
const INITIAL_STATE: RealmState = {
  rings: 0,
  population: {
    total: 4,
    availableWorkers: 4,
    assignedWorkers: 0
  },
  wellness: 0,
  foodStatus: FoodStatus.STARVING,
  date: { turn: 1 },
  tax: {
    amount: 50,
    daysUntilDue: 4,
    status: 'PAID'
  },
  baronPatience: 50,
  buildings: [],
  phase: TurnPhase.MIDDAY,
  ownedHexes: [],
  actionPoints: { current: 2, max: 2 },
  
  // NEW
  titles: ['SURVIVOR'],      // Start with SURVIVOR
  threat: 0,
  lastDelveTurn: 0,
  clocks: []
};
```

---

## Addendum 003: DELVE Restriction

### Problem

DELVE should only be available once per month (4 turns), but this isn't enforced.

### Solution

Track last DELVE turn and validate before allowing action.

### Constants

```typescript
export const DELVE_COOLDOWN_TURNS = 4;  // 4 turns = 1 month
```

### Handler Update

```typescript
export function handleDelve(state: RealmState, payload: DelveActionPayload): ActionResult {
  // Check cooldown
  const turnsSinceLastDelve = state.date.turn - state.lastDelveTurn;
  
  if (state.lastDelveTurn > 0 && turnsSinceLastDelve < DELVE_COOLDOWN_TURNS) {
    const turnsRemaining = DELVE_COOLDOWN_TURNS - turnsSinceLastDelve;
    return { 
      success: false, 
      message: `Cannot DELVE yet. ${turnsRemaining} turn(s) until ready.` 
    };
  }
  
  // ... existing DELVE logic ...
  
  // On success, update lastDelveTurn
  return {
    newState: {
      ...resultState,
      lastDelveTurn: state.date.turn
    },
    success: true,
    message: eventLog
  };
}
```

### UI Indicator

The DELVE action button should show cooldown status:
- Available: Normal button
- Cooldown: Grayed out with "X turns" indicator
- Ready next turn: Pulsing/highlighted

---

## Addendum 004: Plot Capacity (Building Points)

### Problem

Each hex should have limited building capacity (100 BP), but this isn't tracked.

### Solution

Add `buildingPoints` to hex data and check capacity on BUILD.

### Type Changes

```typescript
// OLD
export interface OwnedHex {
  id: string;
  landTags: string[];
}

// NEW
export interface OwnedHex {
  id: string;
  landType: string;           // "Forest", "Meadow", etc.
  landTags: string[];
  buildingPoints: {
    total: number;            // Usually 100, but terrain can modify
    used: number;             // Sum of building sizes in this hex
  };
  // Optional future expansion
  claimStatus?: 'OWNED' | 'CONTESTED' | 'UNCLAIMED';
  adjacentHexes?: string[];   // For threat spread calculations
}
```

### Capacity Check in Build Validator

```typescript
export function canBuild(buildingId: string, hexId: string, state: RealmState): ValidationResult {
  const def = getBuildingDef(buildingId);
  if (!def) return { canBuild: false, reason: 'Invalid Building ID' };
  
  // Find target hex
  const hex = state.ownedHexes.find(h => h.id === hexId);
  if (!hex) return { canBuild: false, reason: 'Hex not owned' };
  
  // Check capacity
  const availableBP = hex.buildingPoints.total - hex.buildingPoints.used;
  if (def.size > availableBP) {
    return { 
      canBuild: false, 
      reason: `Insufficient space. Need ${def.size} BP, have ${availableBP} BP` 
    };
  }
  
  // ... rest of validation ...
}
```

### Update Used BP on Build

```typescript
// In handleBuild, after creating the building:
const updatedHexes = state.ownedHexes.map(h => {
  if (h.id === payload.hexId) {
    return {
      ...h,
      buildingPoints: {
        ...h.buildingPoints,
        used: h.buildingPoints.used + def.size
      }
    };
  }
  return h;
});
```

---

## Addendum 005: Terrain Building Modifiers

### Problem

Different terrain types should affect building costs, starting HP, and build restrictions.

### Solution

Create a terrain modifier lookup and apply during BUILD action.

### Terrain Modifier Data

```typescript
export interface TerrainModifier {
  costModifier: number;      // Multiplier (1.0 = normal, 1.2 = +20%)
  costFlat: number;          // Flat addition/subtraction
  startingHPBonus: number;   // Added to starting HP (usually 0)
  buildRestrictions: string[]; // Building types that CANNOT be built here
  buildExclusive: string[];    // ONLY these building types allowed (empty = all)
  prepTime: number;          // Turns of prep before construction can start
  specialRules: string[];    // Text descriptions of special rules
}

export const TERRAIN_MODIFIERS: Record<string, TerrainModifier> = {
  'Barren': {
    costModifier: 1.0,
    costFlat: 10,
    startingHPBonus: 0,
    buildRestrictions: ['well'],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Wells cannot be built']
  },
  'Burnt Woodland': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 6,
    specialRules: ['Requires 6 turns of ground preparation before building']
  },
  'Fields': {
    costModifier: 0.8,
    costFlat: 0,
    startingHPBonus: 2,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Ideal farmland']
  },
  'Grassland': {
    costModifier: 0.9,
    costFlat: 0,
    startingHPBonus: 1,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: []
  },
  'Heathland': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: ['*'],  // All buildings restricted
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Cannot build on Heathland']
  },
  'Hills': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: []
  },
  'Lake': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: ['*'],
    buildExclusive: ['fishery'],  // ONLY fishery allowed
    prepTime: 0,
    specialRules: ['Only Fishery can be built, occupies entire lake']
  },
  'Marshland': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: ['*'],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Cannot build on Marshland']
  },
  'Meadow': {
    costModifier: 0.8,
    costFlat: 0,
    startingHPBonus: 2,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Excellent building conditions']
  },
  'Rocky': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Single rocky plot has size 50 (half capacity)']
  },
  'Shrubland': {
    costModifier: 1.2,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Clearing required, +20% cost']
  },
  'Woodland': {
    costModifier: 1.0,
    costFlat: -5,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Timber available, -5 Rings cost']
  },
  
  // Our additional land types from land-types.md
  'Forest': {
    costModifier: 1.0,
    costFlat: -5,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Timber available']
  },
  'Old-Growth Forest': {
    costModifier: 1.1,
    costFlat: -5,
    startingHPBonus: 0,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 1,
    specialRules: ['Dense growth requires clearing, but excellent timber']
  },
  'Bog': {
    costModifier: 1.0,
    costFlat: 0,
    startingHPBonus: 0,
    buildRestrictions: ['*'],
    buildExclusive: ['peat_harvest'],
    prepTime: 0,
    specialRules: ['Only Peat Harvest allowed']
  },
  'Floodplain': {
    costModifier: 0.9,
    costFlat: 0,
    startingHPBonus: 1,
    buildRestrictions: [],
    buildExclusive: [],
    prepTime: 0,
    specialRules: ['Fertile but flood risk during events']
  }
};
```

### Apply Modifiers in Build Handler

```typescript
export function calculateBuildCost(def: BuildingDefinition, hex: OwnedHex): number {
  const terrain = TERRAIN_MODIFIERS[hex.landType];
  if (!terrain) return def.cost;  // Default if terrain unknown
  
  let cost = def.cost;
  cost = Math.floor(cost * terrain.costModifier);
  cost = cost + terrain.costFlat;
  
  return Math.max(1, cost);  // Minimum 1 Ring
}

export function calculateStartingHP(def: BuildingDefinition, hex: OwnedHex): number {
  const terrain = TERRAIN_MODIFIERS[hex.landType];
  if (!terrain) return 0;
  
  return terrain.startingHPBonus;  // Added to the 0 starting HP
}

export function canBuildOnTerrain(buildingId: string, hex: OwnedHex): ValidationResult {
  const terrain = TERRAIN_MODIFIERS[hex.landType];
  if (!terrain) return { canBuild: true };
  
  // Check if all buildings restricted
  if (terrain.buildRestrictions.includes('*')) {
    // Check exclusive list
    if (terrain.buildExclusive.length > 0) {
      if (!terrain.buildExclusive.includes(buildingId)) {
        return { 
          canBuild: false, 
          reason: `Only ${terrain.buildExclusive.join(', ')} can be built on ${hex.landType}` 
        };
      }
    } else {
      return { canBuild: false, reason: `Cannot build on ${hex.landType}` };
    }
  }
  
  // Check specific restrictions
  if (terrain.buildRestrictions.includes(buildingId)) {
    return { canBuild: false, reason: `${buildingId} cannot be built on ${hex.landType}` };
  }
  
  return { canBuild: true };
}
```

---

## Addendum 006: Food Formula Clarification

### Problem

Design doc says `demand = population ÷ 4`, code says `demand = population × 1`.

### Decision

Use the design doc formula: **Population ÷ 4 (rounded up)**

This is less punishing early game and creates better pacing.

### Updated Food Calculator

```typescript
export const FOOD_PER_POPULATION_UNIT = 4;  // 4 pop per 1 food demand

export const calculateFoodDemand = (population: RealmPopulation): number => {
  return Math.ceil(population.total / FOOD_PER_POPULATION_UNIT);
};

// Examples:
// Pop 4 = Demand 1
// Pop 8 = Demand 2
// Pop 12 = Demand 3
// Pop 20 = Demand 5
```

### Food Status Thresholds (Revised)

```typescript
export const calculateFoodStatus = (
  population: RealmPopulation, 
  buildings: BuildingInstance[]
): FoodCalculationResult => {
  const demand = calculateFoodDemand(population);
  const supply = calculateFoodSupply(buildings);
  const net = supply - demand;

  let status: FoodStatus;
  
  if (net >= 2) {
    status = FoodStatus.SURPLUS;      // Supply >= Demand + 2
  } else if (net >= 0) {
    status = FoodStatus.FED;          // Supply >= Demand
  } else if (net >= -1) {
    status = FoodStatus.SHORTAGE;     // Supply = Demand - 1
  } else {
    status = FoodStatus.STARVATION;   // Supply < Demand - 1
  }

  return { demand, supply, net, status };
};
```

### Updated FoodStatus Enum

```typescript
export enum FoodStatus {
  SURPLUS = 'SURPLUS',       // +1 Wellness/turn, growth possible
  FED = 'FED',               // Stable (renamed from STABLE)
  SHORTAGE = 'SHORTAGE',     // -1 Wellness/turn, no growth
  STARVATION = 'STARVATION'  // -2 Wellness/turn, population loss
}
```

---

## Addendum 007: Land Claims & Disputes

### Problem

Exploring a hex doesn't automatically mean you own it. There should be contest mechanics.

### Claim Rules

```typescript
export const CLAIM_CONTEST_CHANCE = 0.375;  // 3 in 8 (37.5%) chance of contested

export interface ClaimResult {
  claimed: boolean;
  contested: boolean;
  contestedBy?: string;  // NPC/faction name
}

export function attemptClaim(hexId: string, state: RealmState): ClaimResult {
  // Roll d8: 1-3 = contested, 4-8 = available
  const roll = Math.floor(Math.random() * 8) + 1;
  
  if (roll <= 3) {
    // Contested! Someone else has a claim
    return {
      claimed: false,
      contested: true,
      contestedBy: generateClaimant()  // Random NPC/faction
    };
  }
  
  return {
    claimed: true,
    contested: false
  };
}
```

### Dispute Resolution

```typescript
export interface DisputeRequirements {
  canDispute: boolean;
  reason?: string;
}

export function canDisputeClaim(hexId: string, state: RealmState): DisputeRequirements {
  // Must own 2 adjacent hexes to dispute
  const adjacentOwned = countAdjacentOwnedHexes(hexId, state);
  
  if (adjacentOwned < 2) {
    return { 
      canDispute: false, 
      reason: `Must own at least 2 adjacent hexes to dispute (have ${adjacentOwned})` 
    };
  }
  
  return { canDispute: true };
}

// Dispute resolution could be:
// - Automatic (pay fee to Actuary)
// - Event-based (negotiation, conflict)
// - Time-based (wait X turns)
```

### Unclaimed Land Pressure

```typescript
// If player doesn't claim available land, it becomes claimed by someone else
export function processUnclaimedLand(exploredHex: ExploredHex, state: RealmState): void {
  if (!exploredHex.claimedByPlayer && !exploredHex.contested) {
    // After 1 turn, someone else claims it
    exploredHex.claimStatus = 'CLAIMED_BY_OTHER';
    exploredHex.claimedBy = generateClaimant();
  }
}
```

---

## Addendum 008: Threat System Implementation

### Threat Sources

```typescript
export interface ThreatSource {
  sourceId: string;
  sourceType: 'UNIQUE' | 'DOMAIN' | 'AFFLICTION' | 'ADJACENT';
  threatValue: number;
  hexId?: string;
}

export function calculateTotalThreat(state: RealmState): number {
  let threat = 0;
  const sources: ThreatSource[] = [];
  
  // From Unquiet Domains
  state.clocks
    .filter(c => c.type === 'UNQUIET')
    .forEach(clock => {
      const value = clock.filled <= 2 ? 2 : 4;  // 2 for low, 4 for high
      threat += value;
      sources.push({
        sourceId: clock.id,
        sourceType: 'DOMAIN',
        threatValue: value
      });
    });
  
  // From Afflictions
  state.clocks
    .filter(c => c.type === 'AFFLICTION')
    .forEach(clock => {
      threat += 3;  // Flat 3 per active affliction
      sources.push({
        sourceId: clock.id,
        sourceType: 'AFFLICTION',
        threatValue: 3
      });
    });
  
  // From adjacent uncleansed domains (future: hex adjacency)
  // threat += countAdjacentDomains(state) * 1;
  
  return threat;
}
```

### Threat Effects (Dawn Phase)

```typescript
export function applyThreatEffects(state: RealmState): ThreatResult {
  const threat = calculateTotalThreat(state);
  const log: string[] = [];
  let wellnessChange = 0;
  let buildingDamage: { buildingId: string; damage: number }[] = [];
  
  if (threat === 0) {
    log.push('Peace reigns. No threats loom.');
  } else if (threat <= 3) {
    log.push('Threats stir at the borders.');
    // Occasional outer building damage (10% chance)
    if (Math.random() < 0.1) {
      const outerBuilding = getRandomOuterBuilding(state);
      if (outerBuilding) {
        buildingDamage.push({ buildingId: outerBuilding.id, damage: 1 });
      }
    }
  } else if (threat <= 6) {
    log.push('Danger presses against the realm.');
    wellnessChange = -1;
    // Guaranteed outer building damage
    const outerBuilding = getRandomOuterBuilding(state);
    if (outerBuilding) {
      buildingDamage.push({ buildingId: outerBuilding.id, damage: 1 });
    }
  } else if (threat <= 9) {
    log.push('CRISIS! The realm is under siege!');
    wellnessChange = -2;
    // Multiple buildings take damage
    const buildings = getOuterBuildings(state, 2);
    buildings.forEach(b => {
      buildingDamage.push({ buildingId: b.id, damage: 2 });
    });
  } else {
    log.push('CATASTROPHE! All is threatened!');
    wellnessChange = -3;
    // All buildings take damage, population flees
    state.buildings.forEach(b => {
      buildingDamage.push({ buildingId: b.id, damage: 1 });
    });
  }
  
  return { wellnessChange, buildingDamage, log };
}
```

---

## Addendum 009: Action Type Expansion

### Updated Action Types

```typescript
export enum RealmActionType {
  // Core Actions
  BUILD = 'BUILD',
  EXPLORE = 'EXPLORE',
  DELVE = 'DELVE',
  REPAIR = 'REPAIR',        // Also "Help Build"
  
  // Economy Actions
  TRADE = 'TRADE',
  CARAVAN = 'CARAVAN',      // Send goods to distant town
  
  // Threat Actions
  CLEAR = 'CLEAR',          // Remove non-Domain threat
  FORTIFY = 'FORTIFY',      // Boost defenses
  
  // Social Actions
  FESTIVAL = 'FESTIVAL',    // +2 Wellness, costs Rings
  DECREE = 'DECREE',        // Policy changes
  REST = 'REST',            // +1 Wellness, do nothing
  
  // Knowledge Actions
  RESEARCH = 'RESEARCH',    // Requires LEARNING tag
  
  // Free Actions
  MANAGE_WORKERS = 'MANAGE_WORKERS'  // Doesn't cost AP
}
```

### Action Payloads

```typescript
export interface RepairActionPayload {
  buildingId: string;
}

export interface ClearActionPayload {
  targetHexId: string;
  threatId: string;
}

export interface TradeActionPayload {
  merchantId?: string;
  transactions: { itemId: string; quantity: number; isSelling: boolean }[];
}

export interface FestivalActionPayload {
  ringsToSpend: number;  // Minimum 10
}

export interface DecreeActionPayload {
  decreeType: 'EXPANSION' | 'TAXATION' | 'HOLIDAY' | 'LABOR';
  level: string;
}

export interface ResearchActionPayload {
  topic: string;
}
```

---

## Addendum 010: Loot & Commerce System

### Loot Handling

```typescript
export interface LootItem {
  id: string;
  name: string;
  type: 'RINGS' | 'TRADE_GOOD' | 'EQUIPMENT' | 'MATERIAL' | 'ARTIFACT';
  value: number;           // Base Ring value
  stackable: boolean;
  quantity: number;
}

// Add to RealmState
export interface RealmState {
  // ...existing...
  inventory: LootItem[];   // Unsold loot
}
```

### Commerce Options

```typescript
// Option A: Merchant visits (event-based)
export interface MerchantVisit {
  merchantId: string;
  merchantName: string;
  turnsRemaining: number;  // How long they stay
  buyPrices: Record<string, number>;   // What they'll pay
  sellInventory: LootItem[];            // What they're selling
}

// Option B: Buildings enable selling
export function canSellLoot(state: RealmState): boolean {
  const hasTrade = resolveAvailableTags(state).includes('TRADE');
  const hasMerchant = state.activeMerchant !== null;
  
  return hasTrade || hasMerchant;
}

// Option C: Caravan action
export interface CaravanResult {
  ringsGained: number;
  turnsUntilReturn: number;
  risk: 'SAFE' | 'AMBUSHED' | 'LOST';
}

export function sendCaravan(inventory: LootItem[], state: RealmState): CaravanResult {
  const totalValue = inventory.reduce((sum, item) => sum + (item.value * item.quantity), 0);
  
  // Risk based on threat level
  const threatRisk = state.threat > 5 ? 0.3 : state.threat > 2 ? 0.1 : 0.05;
  const roll = Math.random();
  
  if (roll < threatRisk * 0.5) {
    return { ringsGained: 0, turnsUntilReturn: 2, risk: 'LOST' };
  } else if (roll < threatRisk) {
    return { ringsGained: Math.floor(totalValue * 0.5), turnsUntilReturn: 2, risk: 'AMBUSHED' };
  }
  
  return { ringsGained: totalValue, turnsUntilReturn: 1, risk: 'SAFE' };
}
```

---

## Addendum 011: Title Progression

### Title Checks

```typescript
export function checkTitleEligibility(state: RealmState): TitleId[] {
  const newTitles: TitleId[] = [];
  const currentTitles = state.titles;
  
  // FOUNDER: 3 hexes + Pop 8+
  if (!currentTitles.includes('FOUNDER')) {
    if (state.ownedHexes.length >= 3 && state.population.total >= 8) {
      newTitles.push('FOUNDER');
    }
  }
  
  // THANE: Pop 15+ + Manor + 1 Domain cleared
  if (!currentTitles.includes('THANE')) {
    const hasManor = state.buildings.some(b => b.defId === 'manor' && b.isBuilt);
    const domainsCleared = countClearedDomains(state);
    if (state.population.total >= 15 && hasManor && domainsCleared >= 1) {
      newTitles.push('THANE');
    }
  }
  
  // LORD: Rank 8 Domain + Guild Hall + Pop 25+
  if (!currentTitles.includes('LORD')) {
    const hasGuildHall = state.buildings.some(b => b.defId === 'guild_hall' && b.isBuilt);
    const rank8Cleared = hasRank8DomainCleared(state);
    if (state.population.total >= 25 && hasGuildHall && rank8Cleared) {
      newTitles.push('LORD');
    }
  }
  
  // ... WARDEN, SAGE, HIGH_PRIEST checks ...
  
  return newTitles;
}

// Call during Dawn phase
export function processTitleProgression(state: RealmState): TitleResult {
  const newTitles = checkTitleEligibility(state);
  const log: string[] = [];
  
  newTitles.forEach(title => {
    log.push(`TITLE EARNED: ${title}! New possibilities await.`);
  });
  
  return {
    newTitles: [...state.titles, ...newTitles],
    log
  };
}
```

---

## Summary: Implementation Priority

### High Priority (Core Functionality)

1. **Addendum 001** — Building HP Unification
2. **Addendum 002** — State Additions (titles, threat, lastDelveTurn)
3. **Addendum 003** — DELVE Restriction
4. **Addendum 006** — Food Formula Fix

### Medium Priority (Gameplay Depth)

5. **Addendum 004** — Plot Capacity
6. **Addendum 005** — Terrain Modifiers
7. **Addendum 008** — Threat System
8. **Addendum 011** — Title Progression

### Lower Priority (Polish & Expansion)

9. **Addendum 007** — Land Claims
10. **Addendum 009** — Action Expansion
11. **Addendum 010** — Loot & Commerce
12. **UI Addendum** — Phase Wheel

---

## Files Reference

- **realm-system.md** — Base design document
- **realm-tags.json** — Tag definitions
- **realm-buildings.json** — Building definitions
- **realm-addendums.md** — This document

---

*The wheel refines itself. The realm grows stronger.*

— Seren 🎲
