# Seed Growth Dungeon Generator
## Geometry-First, Behavior-Driven Layout System

### Status
Design Specification – Ready for Implementation

### Scope
2D dungeon geometry generation using **Seed Growth**.
No content placement. No shaders. No flavor text.
Rooms, corridors, clusters, alignment, symmetry emerge from growth behavior.

---

## 1. Core Philosophy

Seed Growth does NOT:
- place rooms
- connect rooms
- pathfind corridors

Seed Growth:
> grows territory under constraints

Everything else (rooms, corridors, clusters) is **derived**.

This avoids exponential complexity and produces layouts that feel intentional.

---

## 2. High-Level Architecture

[ Domain Rules ] + [ Aspect Biases ]
↓
Growth Physics Config
↓
Seed Growth
↓
Region Labeling
↓
Room/Corridor Extraction

yaml
Copy code

---

## 3. Fundamental Concepts

### 3.1 Grid
- Discrete 2D grid (tile-based)
- Each tile has:
  - `state`: empty | floor | blocked
  - `regionId`: integer (seed ancestry)

---

### 3.2 Seeds
A **seed** is a starting tile that begins growth.

Each seed has:
- `id`
- `position`
- `growthWeight`
- `allowedDirections`
- `tags` (derived from Domain/Aspect)

Seeds are **not rooms**.
They are growth origins.

---

### 3.3 Frontier
For each seed/region:
- Maintain a list of **frontier tiles**
- A frontier tile is an empty tile adjacent to the region

Growth always occurs from the frontier.

---

## 4. Growth Loop (Core Algorithm)

Repeat until:
- total grown tiles ≥ tile budget
- OR no valid frontier tiles remain

### Step 1: Select Active Region
Choose which region grows next.

Weighted by:
- region size (optional dampening)
- region priority (from Domain/Aspect)
- symmetry constraints (mirrored selection)

---

### Step 2: Select Frontier Tile
From the region’s frontier, select a candidate tile.

Selection weight factors:
- number of adjacent tiles already in region (`c`)
- direction alignment bonus
- turn penalty (if changing direction)
- symmetry constraints
- Domain/Aspect modifiers

Canonical OPD weight formula (simplified):
weight = pow(c, gamma)

yaml
Copy code

Where:
- `gamma > 1` → round, clustered growth
- `gamma < 1` → tendrils and branches

---

### Step 3: Validate Placement
Reject candidate if:
- tile is blocked
- violates symmetry rule
- causes forbidden adjacency (e.g., diagonal-only touch if disallowed)
- exceeds neighbor limit (Isaac-style anti-loop rule, optional)

---

### Step 4: Grow
- Mark tile as `floor`
- Assign `regionId`
- Add new frontier tiles
- Remove tile from frontier

---

## 5. Symmetry (Critical)

Symmetry is applied at the **growth level**, not the room level.

### Implementation
- Define symmetry axis (vertical or horizontal)
- For every accepted growth at `(x, y)`:
  - compute mirror `(x', y')`
  - validate mirror tile
  - grow both or neither

### Effect
- Symmetry emerges naturally
- No post-hoc mirroring
- Growth pressure is mirrored, not geometry copied

---

## 6. Domain as Growth Physics

Domains define **hard rules**.

### Dungeon Domain
- Orthogonal growth only
- High straight-bias
- High turn penalty
- Corridor-width = constant
- High gamma (round clusters)
- Limited branching

### Cavern Domain
- Allow diagonal growth
- Low turn penalty
- Variable width
- Low gamma (organic tendrils)
- High branching

Domain sets:
- `gamma`
- `turnPenalty`
- `branchPenalty`
- `neighborLimits`
- `directionConstraints`

---

## 7. Aspect as Bias Modifiers

Aspects modify behavior, not rules.

Examples:

### Orderly
- Increase straight-bias
- Reduce branching
- Favor alignment continuation

### Ruined
- Allow breaches
- Lower neighbor constraints
- Enable secondary connections

### Haunted
- Prefer dead ends
- Penalize large open hubs
- Increase isolation bias

Aspects adjust:
- frontier weights
- rejection thresholds
- symmetry strictness

---

## 8. Region Competition (Clusters)

Multiple seeds grow simultaneously.

Rules:
- Regions may not overlap
- Regions stop growing when blocked
- Growth pressure creates **clusters naturally**

Clusters are:
> regions of shared ancestry

No clustering algorithm is needed.

---

## 9. Post-Growth Interpretation

After growth completes:

### 9.1 Identify Regions
Each `regionId` = one cluster.

### 9.2 Room Extraction
A **room** is:
- a contiguous area exceeding area threshold
- or a bulge detected by local width expansion

Corridors are:
- narrow regions between rooms
- or areas below room threshold

### 9.3 Door Placement
Doors placed where:
- region transitions occur
- width narrows
- flow changes direction

Door placement is now trivial because geometry is sane.

---

## 10. Why This Works

- Linear complexity
- No late fixes
- No global pathfinding
- No graph reconciliation
- Symmetry is structural, not cosmetic

Most importantly:
> Geometry implies purpose without naming it.

---

## 11. Mapping to R&R

| R&R Concept | Seed Growth |
|-----------|------------|
| Domain | Growth rule set |
| Aspect | Bias modifier |
| Prompt | Temporary pressure |
| Roll | Parameter change |
| Interpretation | Geometry emergence |

Tracery is unnecessary.

---

## 12. Minimal Viable Implementation Plan

Phase 1:
- Single seed
- No symmetry
- Dungeon domain only

Phase 2:
- Multiple seeds
- Region competition
- Corridor extraction

Phase 3:
- Symmetry growth
- Aspect overlays
- Domain switching

---

## 13. Non-Goals (Explicit)
- No grammar expansion
- No room templates
- No BSP
- No MST
- No A*

Those approaches conflict with growth-first design.

---

## 14. Final Note

This system is not clever.
It is **correct**.

Everything OPD does elegantly emerges from:
- contiguous growth
- weighted frontier selection
- mirrored pressure

The rest is interpretation.

End of document.