# Corridor Pathfinding & Door Negotiation

## Overview

This document describes the door negotiation and corridor pathfinding system for the seed growth dungeon generator.

---

## Door Negotiation Philosophy

### Core Concept: Shared Entry Line

When multiple doors enter a room, the floor tiles just inside those doors should ideally be on the **same row or column**. This creates a logical "entry line" or "foyer effect" that:
- Optimizes usable interior room space
- Creates visually clean, architectural doorway patterns
- Reduces awkward corridor routing

```
Example: 3 doors with shared entry line at Y=1
┌─────D─────D─────┐
D @   @     @     │  ← All persons on Y=1 (shared entry line)
│                 │
│                 │
└─────────────────┘
```

### Door Placement Rules

| Scenario | Preference | Notes |
|----------|------------|-------|
| **1 door** | 75% centered, 25% varied | Single doors prefer center of wall |
| **2+ doors** | 75% aligned entry, 25% varied | Multiple doors prefer shared entry line |
| **Corners** | Valid, not discouraged | Corner doors are architecturally valid |
| **Variation** | Always desired | Perfect patterns can feel artificial |

---

## Door Position Selection

### Single Door Rooms
- **75% chance**: Door at center of wall (O or Y positions)
- **25% chance**: Door at any valid wall position

### Multi-Door Rooms
When a room has 2+ connections:

1. **Determine facing directions** for all connections
2. **Calculate shared entry lines**:
   - Perpendicular connections (N+W, N+E, S+W, S+E): Can share row OR column
   - Opposite connections (N+S): Share column naturally
   - Opposite connections (E+W): Share row naturally
3. **75% preference** for door positions that create a shared entry line
4. **25% variation** for non-aligned positions (adds variety)

### Entry Line Calculation

For a room with bounds `(x, y, w, h)`:
- **North wall entry line**: `y` (first row inside)
- **South wall entry line**: `y + h - 1` (last row inside)
- **West wall entry line**: `x` (first column inside)
- **East wall entry line**: `x + w - 1` (last column inside)

Doors on multiple walls can share an entry line if:
- North + West doors: both enter at `(x, y)` corner area
- North + East doors: both enter at `(x + w - 1, y)` corner area
- etc.

---

## Negotiation Algorithm

### Phase 1: Connection Analysis
```
For each room R:
  1. Get all MST edges involving R
  2. Group connections by wall direction (N, S, E, W)
  3. Count doors per wall
```

### Phase 2: Entry Line Selection
```
For each room R with connections:
  1. If single connection:
     - 75%: use center of facing wall
     - 25%: use any position on facing wall
  
  2. If multiple connections:
     - Identify compatible entry lines
     - 75%: choose positions that share an entry line
     - 25%: choose positions independently
```

### Phase 3: Mutual Agreement
```
For each MST edge (Room A, Room B):
  1. Room A proposes door position based on its entry line preference
  2. Room B proposes door position based on its entry line preference
  3. Find the shared approach tile(s) between them
  4. Route A* only if needed (rooms not adjacent)
```

---

## A* Routing

After door positions are negotiated:

1. **Adjacent rooms (1-tile gap)**: Single corridor tile, no A* needed
2. **Close rooms (same row/column)**: Direct path, minimal A*
3. **Distant rooms**: Full A* with turn penalties

### A* Cost Factors
- `BASE_COST`: 10 per tile
- `TURN_PENALTY`: 50 for each 90° turn
- `HUG_PENALTY`: 60 for tiles parallel to room walls
- `CORNER_PENALTY`: 500 for corner approaches
- `ROOM_INTERIOR`: Infinity (impassable)

### First Step Constraint
The first step of a corridor MUST continue in the door's exit direction (no immediate turns). This prevents "jitter" at room exits.

---

## Future Considerations

- Pre-computed door slots during room classification
- Door style hints (secret doors, archways, locked doors)
- Corridor width variation (1-tile, 2-tile)
- Diagonal corridor support