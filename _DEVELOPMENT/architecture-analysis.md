# Ruins and Realms - Architecture Analysis

> **Purpose**: Identify systems, problem areas, redundancy, and reorganization opportunities to improve modularity and troubleshooting.

---

## Current System Overview

### 1. **Engine Core** (`src/renderer/src/engine/`)

| Directory | Files | Purpose | Health |
|-----------|-------|---------|--------|
| `/seed-growth/` | 10 | Dungeon generation (Spine + Organic) | ⚠️ Needs refactoring |
| `/systems/` | 6 | Grid systems, player controller, visibility | ✅ Well-organized |
| `/managers/` | 3 | Overworld, Shaders, Themes | ✅ Good |
| `/themes/` | 1 | Theme configuration | ✅ Simple |
| `/filters/` | 3 | PixiJS shader filters | ✅ Modular |
| `/analysis/` | 1 | Dungeon analysis utilities | ✅ Isolated |
| `/ui/` | 2 | Game layout, background system | ✅ Good |
| `/map/` | 2+algo | Terrain loading, map types | ✅ Simple |
| `/tables/` | 2 | Table engine for procedural content | ✅ Isolated |
| Root | 2 | `MapEngine.ts`, `Camera.ts` | ⚠️ MapEngine is growing |

### 2. **UI Components** (`src/renderer/src/components/`)

| File | Lines | Bytes | Status |
|------|-------|-------|--------|
| `GameWindow.tsx` | 2,393 | 93KB | 🔴 **CRITICAL: Monolith** |
| `SeedGrowthControlPanel.tsx` | 1,055 | 51KB | 🔴 **Large but focused** |
| Other 12 files | ~500 | ~30KB | ✅ Appropriate size |

### 3. **Integrations** (`src/renderer/src/integrations/`)

| Directory | Files | Purpose | Health |
|-----------|-------|---------|--------|
| `anvil-dice-app/` | 17+ | Full dice engine from Anvil & Loom | ✅ Self-contained |

### 4. **Facades** (`src/renderer/src/facades/`)

| File | Purpose | Health |
|------|---------|--------|
| `DiceFacade.ts` | Single entry for dice operations | ✅ Proper facade |
| `MapFacade.ts` | Single entry for map operations | ✅ Proper facade |

---

## 🔴 Problem Areas (High Priority)

### 1. **GameWindow.tsx (2,393 lines / 93KB)**

**This is the #1 problem file.** It handles:
- PixiJS application lifecycle
- Dungeon generation orchestration
- Player movement and input
- Visibility/fog of war
- Overworld hex placement
- Terrain placement logic
- Map rendering coordination
- State management for multiple game modes
- UI event handlers
- Animation loops

**Impact**: Any change risks breaking unrelated functionality (as seen today).

**Recommendation**: Split into focused modules:

```
engine/
└── game/
    ├── GameOrchestrator.ts      # High-level game state machine
    ├── DungeonController.ts     # Dungeon mode logic
    ├── OverworldController.ts   # Overworld mode logic
    ├── InputHandler.ts          # Keyboard/mouse input
    └── VisibilityController.ts  # Fog of war logic

components/
└── GameWindow.tsx               # Thin React wrapper (~300 lines max)
```

---

### 2. **DungeonViewRenderer.ts (1,513 lines / 57KB)**

**Responsibilities currently mixed:**
- PixiJS container management
- Pan/zoom interaction
- Room floor rendering
- Wall rendering
- Shadow rendering
- Grid line rendering
- Room label rendering
- Corridor rendering
- Object rendering (doors, stairs)
- Heat map rendering
- Walkmap debug rendering
- Visibility/fog graphics
- **Spine corridor pruning logic** (This caused today's bug!)

**Recommendation**: Extract into layer-based components:

```
engine/
└── dungeon-render/
    ├── DungeonViewRenderer.ts    # Container & coordination only (~200 lines)
    ├── layers/
    │   ├── FloorLayer.ts         # Room/corridor floor rendering
    │   ├── WallLayer.ts          # Wall rendering + shadows
    │   ├── GridLayer.ts          # Grid lines
    │   ├── ObjectLayer.ts        # Doors, stairs, objects
    │   ├── LabelLayer.ts         # Room numbers, debug text
    │   └── DebugLayer.ts         # Heat map, walkmap
    ├── PanZoomController.ts      # Pan/zoom interaction
    └── VisibilityRenderer.ts     # Fog of war graphics
```

---

### 3. **CorridorPathfinder.ts (1,346 lines / 49KB)**

**Contains multiple distinct algorithms:**
- MST room connection building
- Door negotiation system
- A* pathfinding (standard)
- A* pathfinding (spine-aware with heat/gradient)
- Runway validation
- Direct corridor shortcuts
- Room gap calculations
- Multiple cost calculation methods

**Recommendation**: Split by algorithm:

```
engine/
└── pathfinding/
    ├── CorridorPathfinder.ts     # Facade + coordination (~200 lines)
    ├── algorithms/
    │   ├── AStarPathfinder.ts    # Core A* implementation
    │   ├── MSTBuilder.ts         # Minimum spanning tree
    │   └── DoorNegotiator.ts     # Door position negotiation
    ├── cost/
    │   ├── BaseCostCalculator.ts # Standard costs
    │   └── SpineCostCalculator.ts# Spine-aware costs
    └── types.ts                  # PathNode, cost constants
```

---

### 4. **Seed-Growth System Coupling**

The 10 files in `/seed-growth/` are tightly interrelated:

| File | Lines | Dependencies |
|------|-------|--------------|
| `types.ts` | 612 | Base (used by all) |
| `SpineSeedGenerator.ts` | 1,160 | types |
| `SeedGrowthGenerator.ts` | ~500 | types |
| `CorridorPathfinder.ts` | 1,346 | types |
| `DungeonViewRenderer.ts` | 1,513 | ALL of the above |
| `DungeonDecorator.ts` | ~350 | types, rooms |
| `RoomClassifier.ts` | ~450 | types |
| Renderers (2) | ~900 | types, state |

**The issue**: `DungeonViewRenderer.ts` does BOTH rendering AND corridor generation/pruning. These should be separate.

---

## ⚠️ Medium Priority Issues

### 1. **SeedGrowthControlPanel.tsx (1,055 lines / 51KB)**

While large, it's a single-purpose UI component with clear tab structure. Could be split into:
- `SeedGrowthControlPanel.tsx` - Main wrapper + tab navigation (~150 lines)
- `tabs/MainTab.tsx` - Main generation controls
- `tabs/AnimationTab.tsx`
- `tabs/MaskTab.tsx`
- `tabs/DebugTab.tsx`
- `tabs/OutputTab.tsx`
- `tabs/FXTab.tsx`

**Priority**: Medium - Works fine, just large.

---

### 2. **Redundant Heat Map Code**

Found in multiple places:
- `DungeonViewRenderer.ts` - `renderHeatMap()` method
- `DungeonViewRenderer.ts` - `calculateWallHeatScores()` method
- `CorridorPathfinder.ts` - Heat map consumption

**Recommendation**: Create `engine/seed-growth/HeatMapCalculator.ts`

---

### 3. **MapEngine Growing Responsibilities**

`MapEngine.ts` (337 lines) is still manageable but handles:
- Camera management
- Grid system selection
- Layer management
- Pointer events
- Highlight valid moves

Consider extracting `InteractionHandler.ts` before it grows further.

---

## ✅ Well-Organized Areas (Don't Touch)

1. **Grid Systems** (`/systems/`) - Clean inheritance: `BaseGridSystem` → `SquareGridSystem`/`HexGridSystem`
2. **Dice Engine** (`/integrations/anvil-dice-app/`) - Self-contained, component-based
3. **Facades** - Proper single entry points
4. **Filters** - Each filter in its own file
5. **Themes** - Type definitions isolated
6. **Tables** - Clean TableEngine with JSON data

---

## Recommended Reorganization Structure

```
src/renderer/src/engine/
├── core/
│   ├── MapEngine.ts
│   ├── Camera.ts
│   └── InteractionHandler.ts (NEW)
│
├── game/                        (NEW - from GameWindow.tsx)
│   ├── GameOrchestrator.ts
│   ├── DungeonController.ts
│   ├── OverworldController.ts
│   ├── InputHandler.ts
│   └── VisibilityController.ts
│
├── dungeon/                     (RENAMED from seed-growth)
│   ├── generation/
│   │   ├── SpineSeedGenerator.ts
│   │   ├── SeedGrowthGenerator.ts
│   │   └── DungeonDecorator.ts
│   │
│   ├── pathfinding/             (EXTRACTED from CorridorPathfinder)
│   │   ├── CorridorPathfinder.ts (facade)
│   │   ├── AStarPathfinder.ts
│   │   ├── MSTBuilder.ts
│   │   └── DoorNegotiator.ts
│   │
│   ├── render/                  (EXTRACTED from DungeonViewRenderer)
│   │   ├── DungeonViewRenderer.ts (coordinator)
│   │   ├── layers/
│   │   │   ├── FloorLayer.ts
│   │   │   ├── WallLayer.ts
│   │   │   ├── GridLayer.ts
│   │   │   ├── ObjectLayer.ts
│   │   │   └── DebugLayer.ts
│   │   ├── PanZoomController.ts
│   │   └── VisibilityRenderer.ts
│   │
│   ├── analysis/
│   │   ├── DungeonAnalysis.ts
│   │   ├── RoomClassifier.ts
│   │   └── HeatMapCalculator.ts (NEW)
│   │
│   └── types.ts
│
├── grid/                        (RENAMED from systems)
│   ├── BaseGridSystem.ts
│   ├── SquareGridSystem.ts
│   ├── HexGridSystem.ts
│   ├── HexLogic.ts
│   └── VisibilitySystem.ts
│
├── managers/                    (unchanged)
├── themes/                      (unchanged)
├── filters/                     (unchanged)
├── tables/                      (unchanged)
└── ui/                          (unchanged)
```

---

## Action Plan (Suggested Phases)

### Phase 1: Critical Extraction (Highest Impact)
1. Extract corridor pruning logic from `DungeonViewRenderer.ts` into `SpinePruner.ts`
2. Split `DungeonViewRenderer.ts` rendering into layer files
3. This directly prevents bugs like today's spine width issue

### Phase 2: GameWindow Decomposition
1. Extract `DungeonController.ts` from `GameWindow.tsx`
2. Extract `OverworldController.ts`
3. Extract `InputHandler.ts`
4. Reduce `GameWindow.tsx` to ~300 line React wrapper

### Phase 3: CorridorPathfinder Cleanup
1. Extract `MSTBuilder.ts`
2. Extract `DoorNegotiator.ts`  
3. Extract `AStarPathfinder.ts` with configurable cost calculators

### Phase 4: UI Polish
1. Split `SeedGrowthControlPanel.tsx` into tab components
2. Add proper prop drilling or context for settings

---

## Key Principles for Refactoring

1. **Single Responsibility**: Each file should do ONE thing
2. **Facade Pattern**: Complex subsystems get a simple entry point
3. **Layer Separation**: Rendering, Logic, Data should be separate
4. **No Side Effects**: Functions that calculate shouldn't also render
5. **Small Files**: Target 200-400 lines max per file
6. **Clear Dependencies**: Imports should flow one direction (no cycles)

---

## File Size Reference

| Status | Size | Description |
|--------|------|-------------|
| 🔴 Critical | >1000 lines | Split immediately |
| ⚠️ Warning | 500-1000 lines | Monitor, split when touching |
| ✅ Good | <500 lines | Ideal target |

**Current Violations:**
- `GameWindow.tsx`: 2,393 lines 🔴
- `DungeonViewRenderer.ts`: 1,513 lines 🔴
- `CorridorPathfinder.ts`: 1,346 lines 🔴
- `SpineSeedGenerator.ts`: 1,160 lines 🔴
- `SeedGrowthControlPanel.tsx`: 1,055 lines 🔴

---

*Generated: 2024-12-31*
