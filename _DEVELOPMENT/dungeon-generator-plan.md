# Dungeon Generator Implementation Plan

## Overview

This plan describes how to build a clean `DungeonGenerator` that follows the rules in `map-rules.md`. The generator will be logic-only (no rendering initially), using PixiJS later for display.

---

## Phase 1: Core Data Structures

### 1.1 Create `DungeonGenerator.ts`

Location: `src/core/dungeon/DungeonGenerator.ts`

**State it manages:**

```typescript
interface DungeonState {
  // Map dimensions
  width: number // Total width including border (user choice + 4)
  height: number // Total height including border (user choice + 4)

  // Grid state (occupancy)
  grid: OccupancyState[][] // 2D array: OPEN, ROOM, CORRIDOR, DEAD_ZONE

  // Entrance
  entrance: { gx: number; gy: number } | null

  // Rooms
  rooms: DungeonRoom[]

  // Exits (corridors)
  exits: DungeonExit[]

  // Current step in workflow
  step: DungeonStep

  // Level metadata
  levelNumber: number
  levelName: string
}

interface DungeonRoom {
  id: string
  gx: number // Grid X (top-left)
  gy: number // Grid Y (top-left)
  width: number // Width in tiles
  height: number // Height in tiles
  classification: RoomClassification
  connectionSide: WallSide // Which wall connects to parent
  parentExitId: string | null
}

interface DungeonExit {
  id: string
  gx: number
  gy: number
  wall: WallSide // Which wall of parent room
  parentRoomId: string
  connectedRoomId: string | null // null if not yet expanded
}

type OccupancyState = 'OPEN' | 'ROOM' | 'CORRIDOR' | 'DEAD_ZONE'
type WallSide = 'top' | 'bottom' | 'left' | 'right'
type DungeonStep =
  | 'idle'
  | 'place-entrance'
  | 'roll-start-room'
  | 'place-start-room'
  | 'roll-exits'
  | 'place-exits'
  | 'complete'
  | 'expand-roll'
  | 'expand-place'
```

---

## Phase 2: Level Name from Table

### 2.1 Roll for Level Name

When user clicks "Create New Level":

1. Determine which level number this is (1-10)
2. Roll 1d10 to pick from the 10 names for that level
3. Level 1 = entries 1-10, Level 2 = entries 11-20, etc.
4. Use the table at `app/core-data/tables/oracles/dungeon-level-names.json`

**Example:**

- Level 3, roll 7 → Entry 27 → "Low-Ceilinged Ways"

### 2.2 Table Access

Use the existing `tableEngine.ts` to roll on the table:

```typescript
// Roll for level name
async function rollLevelName(levelNumber: number): Promise<string> {
  // Formula: 1d10 + ((dungeonLevel - 1) * 10)
  const d10 = Math.floor(Math.random() * 10) + 1 // 1-10
  const roll = d10 + (levelNumber - 1) * 10 // Level 1: 1-10, Level 2: 11-20, etc.

  // Lookup in table
  const table = await loadTable('dungeon-level-names')
  const entry = table.tableData.find((e) => e.floor <= roll && e.ceiling >= roll)
  return entry?.result ?? `Level ${levelNumber}`
}
```

---

## Phase 3: Initialize Map

### 3.1 On "OK" Click (Size Selected)

1. Take user's chosen width/height (e.g., 20x20)
2. Add 4 to each dimension → 24x24
3. Initialize the grid:

   ```typescript
   function initGrid(width: number, height: number): OccupancyState[][] {
     const grid: OccupancyState[][] = []

     for (let y = 0; y < height; y++) {
       grid[y] = []
       for (let x = 0; x < width; x++) {
         // 2-tile border is DEAD_ZONE
         if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
           grid[y][x] = 'DEAD_ZONE'
         } else {
           grid[y][x] = 'OPEN'
         }
       }
     }

     return grid
   }
   ```

4. Set step to `'place-entrance'`

### 3.2 Map Size and Centering

- **Finite size only**: The map is exactly `(userWidth + 4) × (userHeight + 4)` tiles. No infinite grid.
- **Center on load**: When the map is loaded/displayed, center the camera on the map.
  ```typescript
  function getCenterPosition(state: DungeonState, gridSize: number): { x: number; y: number } {
    return {
      x: (state.width * gridSize) / 2,
      y: (state.height * gridSize) / 2
    }
  }
  ```
- The renderer (later) should position the camera so the entire map is visible and centered.

---

## Phase 4: Place Entrance

### 4.1 Valid Entrance Positions

Entrance must be:

- On the bottom inner edge: row = `height - 3`
- Within playable X: `2 <= x < width - 2`

```typescript
function isValidEntrancePosition(gx: number, gy: number, state: DungeonState): boolean {
  const bottomRow = state.height - 3
  return gy === bottomRow && gx >= 2 && gx < state.width - 2
}
```

### 4.2 On Entrance Placed

1. Mark entrance position in state
2. Mark tiles LEFT and RIGHT of entrance as DEAD_ZONE:
   ```typescript
   if (gx > 0) grid[gy][gx - 1] = 'DEAD_ZONE'
   if (gx < width - 1) grid[gy][gx + 1] = 'DEAD_ZONE'
   ```
3. Set step to `'roll-start-room'`

---

## Phase 5: Roll Starting Room

### 5.1 Dice Roll

1. Roll 2d6: die1 = width, die2 = height
2. Apply starting room special rules:
   - 1s become 2s (no corridors)
   - Total must be 6-12 tiles
   - Adjust if needed

### 5.2 Calculate Max Limits

Before rolling, calculate the maximum room that can fit:

- Width: From left playable edge (2) to right playable edge (width-2), centered on entrance
- Height: From entrance row upward to top playable edge (2)

```typescript
function getStartingRoomLimits(
  entrance: { gx: number; gy: number },
  state: DungeonState
): { maxWidth: number; maxHeight: number } {
  // Height limit: from row above entrance to top playable edge
  const maxHeight = entrance.gy - 2 // Can go from entrance.gy-1 up to row 2

  // Width limit: how far left/right of entrance within playable area
  const leftSpace = entrance.gx - 2
  const rightSpace = state.width - 2 - entrance.gx - 1

  // Centered, so use min of left/right, then double + 1
  const maxWidth = 1 + 2 * Math.min(leftSpace, rightSpace)

  return { maxWidth, maxHeight }
}
```

### 5.3 Clamp Roll to Limits

If rolled dimensions exceed limits, clamp them.

---

## Phase 6: Place Starting Room

### 6.1 Valid Placement

Room must:

- Have bottom edge touching entrance row (`room.gy + room.height === entrance.gy`)
- Be horizontally positioned such that entrance is within room's X range
- Stay within playable area

### 6.2 On Room Placed

1. Add room to `rooms` array
2. Mark all room tiles as `'ROOM'` in grid
3. Mark 1-tile buffer around room as `'DEAD_ZONE'` (only OPEN tiles)
4. Set step to `'roll-exits'`

---

## Phase 7: Roll and Place Exits (Starting Room)

### 7.1 Roll Number of Exits

Roll 1d3 to determine how many exits to place.

### 7.2 Determine Available Walls

A wall is available if:

- It's NOT the connection side (bottom for starting room)
- The tiles directly outside that wall are NOT blocked (dead zone or other room)

```typescript
function getAvailableWalls(room: DungeonRoom, state: DungeonState): WallSide[] {
  const available: WallSide[] = []

  // Skip the connection side
  const sides: WallSide[] = ['top', 'left', 'right']
  if (room.connectionSide !== 'bottom') sides.push('bottom')

  for (const side of sides) {
    if (!isWallBlocked(room, side, state)) {
      available.push(side)
    }
  }

  return available
}

function isWallBlocked(room: DungeonRoom, side: WallSide, state: DungeonState): boolean {
  // Check the tile(s) directly outside this wall
  switch (side) {
    case 'top':
      // Check row above room
      for (let x = room.gx; x < room.gx + room.width; x++) {
        if (state.grid[room.gy - 1]?.[x] !== 'OPEN') return true
      }
      return false
    case 'bottom':
      // Check row below room
      for (let x = room.gx; x < room.gx + room.width; x++) {
        if (state.grid[room.gy + room.height]?.[x] !== 'OPEN') return true
      }
      return false
    case 'left':
      // Check column left of room
      for (let y = room.gy; y < room.gy + room.height; y++) {
        if (state.grid[y]?.[room.gx - 1] !== 'OPEN') return true
      }
      return false
    case 'right':
      // Check column right of room
      for (let y = room.gy; y < room.gy + room.height; y++) {
        if (state.grid[y]?.[room.gx + room.width] !== 'OPEN') return true
      }
      return false
  }
}
```

### 7.3 Place Exit

When user clicks a valid wall position:

1. Create exit record
2. Mark exit tile as `'CORRIDOR'`
3. Mark sides of exit as `'DEAD_ZONE'` (perpendicular to direction)
4. Add to `exits` array
5. Repeat until required exits placed
6. Set step to `'complete'`

---

## Phase 8: Expansion (Clicking an Exit)

### 8.1 On Exit Clicked

1. Check exit is not already connected
2. Calculate expansion limits from that exit's position/direction
3. Roll 2d6 for new room (with doubles bonus)
4. Clamp to limits
5. Activate room placement tool
6. On placed, mark grid, add room, update exit connection
7. Roll for new room's exits
8. Return to `'complete'`

---

## File Structure

```
src/core/dungeon/
├── DungeonGenerator.ts    # Main class with all logic
├── DungeonTypes.ts        # Type definitions
├── roomBuilder.ts         # Existing dice roll logic (reuse)
└── index.ts               # Exports
```

---

## Integration Points

1. **DiceTool.tsx** - UI triggers generator methods
2. **PloughCanvas.tsx** - Receives draw commands (later)
3. **useDungeonSetupStore.ts** - Replace with simpler state from generator

---

## Implementation Order

1. [ ] Create `DungeonTypes.ts` with all interfaces
2. [ ] Create `DungeonGenerator.ts` with:
   - [ ] Constructor and state initialization
   - [ ] `startNewLevel(width, height, levelNumber)` - uses table for name
   - [ ] `initGrid()` - sets up 2-tile border
   - [ ] `isValidEntrancePosition(gx, gy)`
   - [ ] `placeEntrance(gx, gy)`
   - [ ] `getStartingRoomLimits()`
   - [ ] `isValidRoomPosition(gx, gy, width, height)`
   - [ ] `placeRoom(gx, gy, width, height, connectionSide, parentExitId)`
   - [ ] `getAvailableWalls(roomId)`
   - [ ] `isValidExitPosition(roomId, gx, gy)`
   - [ ] `placeExit(roomId, gx, gy, wall)`
   - [ ] `getExpansionLimits(exitId)`
3. [ ] Wire up to DiceTool.tsx
4. [ ] Test logic in console before rendering
5. [ ] (Later) Create PixiJS renderer that reads generator state

---

## Next Step

Create `DungeonTypes.ts` and `DungeonGenerator.ts` skeleton with the above structure. Does this plan look correct?
