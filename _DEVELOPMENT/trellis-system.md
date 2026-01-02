# Trellis System – Design Specification
For: Architect  
Purpose: Provide a deterministic, phase-aware tag system that influences dungeon architecture without hardcoding geometry or pathing behavior.

This is officially called the Trellis System, as we build these to influence what seeds grow into.

For identification purposes, we absolutely need to call these trellises because we will need tags to alter things that are not map/geometry-related.

---

## 1. Core Principles

1. Trellises are **mechanical**, not descriptive.
2. Every trellis must declare **which generation phase(s)** it can interrupt.
3. Trellises may:
   - Modify geometry
   - Bias probabilities
   - Protect or restrict post-processing
4. Trellises must never:
   - Directly place doors
   - Directly carve corridors
   - Override pathfinding results outright
5. When possible, trellises influence behavior via **heat maps**, not hard rules.

---

## 2. Dungeon Generation Interrupt Table (Reference)

| Step | Phase | Summary | Trellis Access |
|------|-------|---------|------------|
| 1 | Initialization | Head placement and first spine tile | None |
| 2 | spine | Spine growth and shaping | Indirect (query only) |
| 3 | ejection | Seeds dropped from spine | Yes |
| 4 | roomGrowth | Seeds expand into rooms | Yes |
| 5 | classification | Seeds become Room objects, pruning | Yes |
| 6 | corridorAssembly | Corridors and doors generated | Yes |
| 7 | decoration | Doors, stairs, objects | Limited |
| 8 | spinePruning | Dead corridor cleanup | Defensive |
| 9 | rendering | Tile layers built | None |
| 10 | visibility | Fog of war init | None |

Trellises must specify one or more of the phases above.

---

## 3. Trellis Anatomy

Each trellis is defined as a modular rule object. Each is contained in its own file in the `trellis` directory.

Required fields:
- id: string
- phases: array of phases this trellis may interrupt
- rules: hard constraints or invariants
- notes: implementation clarifications

Trellises are composable. Multiple trellises may apply to a single room.

---

## 4. Door Heat Map System

Each room generates a per-wall heat map for door placement.

Baseline behavior:
- Wall centers are hottest
- Heat falls off toward corners
- Corners are valid unless explicitly forbidden

Trellises may modify heat maps using the following operations:
- boost: increase heat
- dampen: reduce heat
- zero: forbid door placement
- shift: move heat bias (center to edge, edge to corner)

Door placement always selects the highest-heat valid tile.

---

## 5. Trellis Definitions (Initial Set)

### Trellis: #cell

Intent: Single-occupancy dead-end room.

Phases:
- classification
- corridorAssembly

Rules:
- Must have exactly one exit

Heat Rules:
- Opposing walls (not shared by another #cell) cooled (-10 heat)
- All walls shared by another #cell are impassable (500 heat)
- All corners zeroed

Notes:
- Does not enforce adjacency; corridor assembly enforces constraints.
- Multi-cell layouts must use #spawn.

---

### Trellis: #spawn (X, Y)

Intent: Deterministic replication of a room.

Parameters:
- X: number of total rooms including original (can be a range A-B)
- Y: spacing in tiles between room origins (can never be less than the width of the room (or height if the spawn is ejected vertically))

Phases:
- ejection

Rules:
- Spawns X-1 additional copies in a straight line
- Orientation inherited from original
- No automatic connectivity
- Spawns share the same room number as the original

Heat Rules:
- None

Notes:
- Spawn occurs before room growth and pruning.
- Spawn does not override connection restrictions of the base tag.

---

### Trellis: #tinytitan

Intent: Protect rooms from post-generation pruning.

Phases:
- classification

Rules:
- Immune to deletion due to:
  - 1x1 size
  - 1-tile-wide shape
  - 1-tile-tall shape

Heat Rules:
- None

Notes:
- Structural protection only.
- Does not affect connectivity or door logic.

---

## 6. Trellis Resolution Order

Within a phase:
1. Structural invariants are evaluated first
2. Heat modifications are applied
3. Conflicts are resolved by lowest-permissive rule
4. Final normalization pass on heat maps

Hard rule:
If two tags conflict, the more restrictive rule wins.

---

## 7. Design Constraints

- Trellises must not require backtracking across phases.
- Trellises must be evaluable in isolation.
- Trellises must degrade gracefully when constraints cannot be satisfied.
- Trellises should bias outcomes rather than enforce geometry when possible.

---

## 8. Example Composite Usage

Prison Cell Row:
- #cell
- #spawn (4, 3)
- #tinytitan

Result:
- Four isolated 1x1 rooms
- One exit per room
- No direct cell-to-cell connections
- No postgen pruning
- Clean door placement via heat bias

---

End of Specification
