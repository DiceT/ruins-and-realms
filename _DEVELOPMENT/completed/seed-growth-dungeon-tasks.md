# Architect Task Breakdown: Seed Growth Dungeon v0 + Control Panel + Aspect Stub
**Goal:** Implement Seed Growth (OPD-inspired) dungeon geometry in 2D with a live control panel for rapid iteration.  
**Scope:** Geometry only. No content/dressing. Doors optional later.  
**Aspect:** Stub only (plumbing, no real effect yet).

---

## 0) Deliverables
### 0.1 Generator Output
- `grid`: tile states + region ids
- `regions`: region metadata (size, frontier size, seed position)
- `rooms`: extracted room blobs (bounds, area, centroid)
- `corridors`: extracted corridor tiles/segments
- `connections`: adjacency graph (room-room edges)

### 0.2 UI Deliverable
- A **Dungeon Control Panel** (sliders/buttons/toggles) that:
  - regenerates instantly on change (debounced)
  - shows numeric readouts
  - can lock/unlock seed
  - can step growth iteratively (optional but recommended)
  - can toggle debug overlays

---

## 1) UI: Dungeon Control Panel (P0)
**Why first:** tuning without UI is pain. We want rapid feedback loops.

### 1.1 Required Controls
**Core**
- `Seed` (int) + button: **Randomize Seed**
- button: **Regenerate**
- button: **Reset Defaults**

**Dungeon Size / Budget**
- `Tile Budget` (int slider): e.g. 200 → 4000
- `Grid Width` (int): e.g. 64–256
- `Grid Height` (int): e.g. 64–256
- toggle: `Auto-fit bounds` (optional; clamps growth to usable area)

**Seeds / Regions**
- `Seed Count` (1–12)
- `Seed Placement` (enum):
  - Centered / Random / Symmetric Pairs
- `Min Seed Distance` (slider): prevents seeds clustering too tightly

**Growth Physics**
- `Gamma` (0.2–3.0)  ← frontier weight exponent
- `Straight Bias` (0–1)  ← prefer continuing direction
- `Turn Penalty` (0–5)   ← cost to change direction
- `Branch Penalty` (0–5) ← penalize creating new branches
- `Neighbor Limit` (0–4) ← Isaac-style loop suppression (optional)
- `Allow Loops` (toggle) OR `Loop Chance` (0–1) (optional)

**Symmetry**
- `Symmetry` (0–100)
- `Symmetry Axis` (enum): Vertical / Horizontal
- `Symmetry Strict` (toggle):
  - If ON: grow mirrored or reject
  - If OFF: if mirror blocked, allow solo growth (for “ruined symmetry” later)

**Room/Corridor Extraction**
- `Min Room Area` (int)
- `Max Corridor Width` (int) (if using width-based classification)
- `Smoothing Passes` (0–5) (optional, see P2)

### 1.2 Debug Toggles (must-have)
- toggle: `Show Regions` (color by regionId)
- toggle: `Show Frontier`
- toggle: `Show Symmetry Axis`
- toggle: `Show Room Bounds`
- toggle: `Show Corridors`
- toggle: `Show Connections Graph`

### 1.3 Optional (nice, high ROI)
- button: `Step Growth` (1 step)
- button: `Run 50 Steps`
- slider: `Steps per frame` (for animated growth)

---

## 2) Core Types & Settings (P0)

### 2.1 Settings Object
Create `DungeonSeedGrowthSettings`:
- `seed: number`
- `gridW, gridH: number`
- `tileBudget: number`

- `seedCount: number`
- `seedPlacement: "center"|"random"|"symmetricPairs"`
- `minSeedDistance: number`

- `gamma: number`
- `straightBias: number`
- `turnPenalty: number`
- `branchPenalty: number`
- `neighborLimit: number`
- `allowLoops: boolean`
- `loopChance?: number` (if allowLoops)

- `symmetry: number` (0–100)
- `symmetryAxis: "vertical"|"horizontal"`
- `symmetryStrict: boolean`

- `minRoomArea: number`
- `maxCorridorWidth?: number`

- `debug: { showRegions, showFrontier, ... }`

### 2.2 Aspect Stub
Create `AspectStub` (placeholder):
- `id: string` (e.g. "None")
- `apply(settings) => settings` (currently returns unchanged)
- Wire it so later Aspects can modify settings without refactor.

---

## 3) Seed Growth Engine (P0)

### 3.1 RNG
- Implement deterministic RNG wrapper (seeded).
- Must support reproducible results on same settings.

### 3.2 Seed Placement
Implement `placeSeeds(settings)`:
- Center: one seed at center; others radial scatter
- Random: uniform random tiles with min distance
- SymmetricPairs: place pairs mirrored about axis (based on symmetry axis)

Return seeds with:
- `id`
- `pos`
- `regionId` (= id)

### 3.3 Frontier Tracking
For each region maintain:
- `frontier: Set<tileIndex>`
- `size: number`
- `lastDir?: Direction` (optional, for straight bias)

Initialize:
- Mark seed tile as Floor, set regionId
- Add neighboring empty tiles to frontier

### 3.4 Frontier Weighting
For each candidate frontier tile:
Compute:
- `c = number of adjacent tiles in same region` (4-neighbor)
Weight:
- `w = pow(c, gamma)`
Modify weight by:
- `straightBias` (bonus if direction continues from last growth)
- `turnPenalty` (reduce weight if direction changes)
- `branchPenalty` (reduce if this tile creates a new branch)
- `neighborLimit` (hard reject if new tile would have too many non-empty neighbors; or too many same-region neighbors; pick one definition and document)

### 3.5 Growth Step
`step()`:
1. Select active region (weighted by frontier size or uniform)
2. Select frontier tile via weighted random
3. Validate:
   - in bounds, empty
   - neighbor constraint
   - symmetry constraints (below)
4. Apply:
   - grow tile (set Floor, regionId)
   - update region size
   - update frontier sets (remove used tile; add new neighbors)

Repeat until tileBudget reached or no frontier remains.

---

## 4) Symmetry Implementation (P0)
Symmetry should operate on **growth**, not post-hoc mirroring.

### 4.1 Probability of Mirrored Growth
Map `symmetry 0–100` to chance:
- `mirrorChance = symmetry / 100`

During each successful growth attempt:
- roll once; if <= mirrorChance, attempt mirrored growth as well.

### 4.2 Mirror Coordinate
- Vertical axis: `x' = (gridW - 1) - x`
- Horizontal axis: `y' = (gridH - 1) - y`

### 4.3 Strictness Behavior
- If `symmetryStrict = true`:
  - if mirror invalid → reject growth entirely
- If `false`:
  - if mirror invalid → allow solo growth (future “ruin drift” friendly)

---

## 5) Post-Processing: Rooms & Corridors (P0)
We need a usable classification to visualize “rooms” vs “corridors.”

### 5.1 Region Extraction
- Regions are already implicit via `regionId`.
- Compute per-region:
  - area
  - bounds
  - centroid
  - frontier size
  - (optional) compactness metric

### 5.2 Room Detection (simple, good enough)
Approach A (fast):
- Flood fill contiguous Floor tiles per region.
- Within each region, identify “room blobs”:
  - either the entire region if you treat regions as clusters
  - OR subdivide by local width (see B)

Approach B (better):
- Compute local thickness for each floor tile (distance to nearest empty/wall).
- Classify:
  - tiles with thickness >= threshold -> room
  - else corridor
- Then flood fill room tiles into room blobs.
- Filter blobs by `minRoomArea`.

Output `rooms[]` with:
- `id`
- `regionId`
- `tiles[]` (or bounds + mask)
- `bounds`
- `area`
- `centroid`

### 5.3 Corridor Extraction
- Corridor tiles are remaining floor tiles not in rooms.
- Optionally compress to polylines later.

### 5.4 Connections Graph (debug)
- Build adjacency between rooms via corridor contact.
- Can be as simple as: if two room blobs are connected via corridor flood fill, add edge.

---

## 6) Rendering & Overlays (P0)
- Render grid floor/walls as you already do.
- Add overlays:
  - region coloring (HSV by id)
  - frontier dots
  - room bounds rectangles
  - corridor tiles highlight
  - symmetry axis line

---

## 7) Performance & UX (P0)
- Debounce regen on slider change (e.g. 150–250ms)
- Provide numeric readouts
- Clamp ranges to avoid “no valid frontier” confusion
- If generation fails (frontier exhausted early), show status:
  - “Stopped: no frontier remaining at X tiles”

---

## 8) P1 Enhancements (High ROI)
- Growth animation mode:
  - step-by-step visualization to tune gamma/penalties
- “Preset” buttons:
  - Dungeon (orthogonal, straight)
  - Cavern (organic)
  - Catacomb (symmetry + corridors)
- Add “Seed heatmap” debug:
  - show growth order (timestamp per tile)

---

## 9) Acceptance Criteria
- Changing any control updates layout deterministically (given same seed/settings).
- `symmetry=100` + symmetricPairs produces near-perfect mirrored growth.
- Regions are visually distinct and coherent.
- Rooms/corridors classification is stable enough to inspect behavior.
- No crashes at max settings; graceful early stop if frontier exhausted.

---

## 10) Notes on Aspect Stub
- Implement `AspectStub.apply(settings)` that returns `settings` unchanged.
- Ensure generator signature includes `aspect?: AspectStub`.
- Do NOT bake assumptions about Aspect behavior yet.

End of task breakdown.
