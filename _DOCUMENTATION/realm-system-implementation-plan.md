# Realm System Implementation Plan

This document outlines the step-by-step implementation of the Realm Management System. It is designed to be executed in bite-sized chunks to ensure stability and testability at each stage.

## Phase 1: Core Data & State Foundation

### 1.1. Core Types Definition
**File:** `src/features/realm/types/realmTypes.ts`
- [ ] Define `RealmCurrency` (Rings).
- [ ] Define `RealmPopulation` (Count, Workers).
- [ ] Define `RealmWellness` (Enum/Range -4 to +4).
- [ ] Define `RealmDate` (Turn count, Season).
- [ ] Define `RealmState` interface aggregating these.

### 1.2. JSON Data Schemas
**File:** `src/features/realm/data/schemas.ts`
- [ ] Define `TagDefinition` interface (Types: Resource, Infrastructure, Special).
- [ ] Define `BuildingDefinition` interface (Costs, Requirements, Outputs).

### 1.3. Static Data Injection
**File:** `src/features/realm/data/tags.json`
- [ ] Create initial JSON with Tier 1 Resource Tags (Timber, Stone, Water, Fertile).

**File:** `src/features/realm/data/buildings.json`
- [ ] Create initial JSON with basic buildings (Farm, Mine, Hovel).

### 1.4. Realm Store Initialization
**File:** `src/features/realm/store/realmStore.ts`
- [ ] Create Zustand store `useRealmStore`.
- [ ] Initialize with "Prison Escape" defaults (Pop: 4, Rings: 2d6, Turn: 1).
- [ ] Create selectors for specific stats.

---

## Phase 2: The Simulation Loop (Turn Processor)

### 2.1. Turn Phase Enums
**File:** `src/features/realm/types/turnTypes.ts`
- [ ] Define `TurnPhase` enum (Dawn, Morning, Midday, Dusk, Night).

### 2.2. Phase: Dawn (Status Check)
**File:** `src/features/realm/logic/phases/processDawn.ts`
- [ ] Implement function to check Food Status (Starvation vs Surplus).
- [ ] Implement Wellness adjustment logic.
- [ ] Implement Population change logic (Growth/Decline).

### 2.3. Phase: Morning (Economy)
**File:** `src/features/realm/logic/phases/processMorning.ts`
- [ ] Implement Income collection (iterate existing buildings).
- [ ] Implement Upkeep deduction.
- [ ] Stub Tax check (every 4th turn).

### 2.4. Phase: Night (Resolution)
**File:** `src/features/realm/logic/phases/processNight.ts`
- [ ] Implement Turn increment.
- [ ] Implement Worker reset (return to pool).

### 2.5. Turn Orchestrator
**File:** `src/features/realm/logic/turnOrchestrator.ts`
- [ ] Create `advanceTurn()` function that calls Dawn -> Morning -> (Player Acts) -> Dusk -> Night in sequence.
- [ ] *Note: Midday is player-controlled and not auto-advanced.*

---

## Phase 3: The Tag & Building Engine

### 3.1. Tag Resolution System
**File:** `src/features/realm/logic/tags/tagResolver.ts`
- [ ] Implement `resolveAvailableTags(state)`:
    - Scans owned Hexes for terrain tags.
    - Scans constructed Buildings for infrastructure tags.
    - Returns unique list of active Tags.

### 3.2. Building Requirement Checker
**File:** `src/features/realm/logic/buildings/buildingValidator.ts`
- [ ] Implement `canBuild(buildingId, state)`:
    - Checks Resource Cost (Rings).
    - Checks Tag Requirements (e.g., specific terrain/infrastructure).
    - Checks Population availability.

### 3.3. Construction Logic
**File:** `src/features/realm/logic/buildings/constructionManager.ts`
- [ ] Implement `startConstruction(buildingId, hexId)`.
- [ ] Add "Under Construction" state to building instance.
- [ ] Update `processMorning` to advance construction clocks.

---

## Phase 4: Actions System

### 4.1. Action Definitions
**File:** `src/features/realm/config/actions.ts`
- [ ] Define available actions map (Build, Explore, Repair, etc.).
- [ ] Define Action Cost structure (AP cost, Resource cost).

### 4.2. Action Dispatcher
**File:** `src/features/realm/logic/actions/actionDispatcher.ts`
- [ ] Implement `executeAction(actionType, payload)`.
- [ ] Validate AP availability (Base 2).
- [ ] Deduct AP and route to specific handler.

### 4.3. Specific Handlers
**Folder:** `src/features/realm/logic/actions/handlers/`
- [ ] `handleExplore.ts`: Reveal adjacent hex logic.
- [ ] `handleRepair.ts`: Restore Building HP.
- [ ] `handleRest.ts`: Simple Wellness boost.

---

## Phase 5: Advanced Mechanics

### 5.1. Food Calculation
**File:** `src/features/realm/logic/economy/foodCalculator.ts`
- [ ] Implement `calculateFoodDemand(population)`.
- [ ] Implement `calculateFoodSupply(buildings)`.
- [ ] Return Food Status enum.

### 5.2. Threat System
**File:** `src/features/realm/logic/threat/threatCalculator.ts`
- [ ] Implement Threat aggregation from Uncleansed Hexes + Events.
- [ ] Add Threat damage step to `processDawn`.

### 5.3. Tax Cycle
**File:** `src/features/realm/logic/economy/taxManager.ts`
- [ ] Implement `calculateTaxes(buildings, policy)`.
- [ ] Implement `payTaxes()` transaction.
- [ ] Implement "Baron's Patience" clock logic on default.

---

## Phase 6: State Persistence & Integration

### 6.1. Save/Load Adapter
**File:** `src/features/realm/persistence/realmAdapter.ts`
- [ ] Adapt RealmState to/from main SaveGame JSON.
- [ ] Ensure Clocks and partial states (construction) persist.

### 6.2. Delve Integration
**File:** `src/features/realm/integration/delveHooks.ts`
- [ ] Implement `onDelveReturn(loot)`: Inject Rings into Realm.
- [ ] Implement `onDomainCleared(domainId)`: Update Hex status/Threat.

