# Addendum: Door Runway + Anti-Hug Routing Rule
Owner: Architect  
Status: P0 – Fixes “arrival wiggle” (corridor turns and hugs room walls near entry)  
Scope: Corridor routing between room connections (post-room detection)

---

## 1) Problem
When a corridor path reaches a room, the router may “get cute”:
- turns sideways near the room
- hugs the room’s outer wall for a few tiles
- then enters at a better-cost point

This creates ugly approaches and awkward door geometry.

We want corridors to **commit** to an entry direction near rooms:
- approach perpendicular
- no wall-tracing right at the room edge

Corner entries are allowed (no special restriction yet).

---

## 2) Solution Overview
Implement two complementary rules:
1. **Door Runway Constraint** (hard constraint): require the last `k` tiles before entry to be straight and perpendicular.
2. **Anti-Hug Penalty** (soft constraint): penalize moves that run parallel to room walls within 1 tile of a room.

These rules do not ban corner entries; they simply prevent “side-sliding” upon arrival.

---

## 3) Door Runway Constraint (Hard Constraint)

### 3.1 Definitions
- `doorCell`: the room boundary tile chosen for the connection
- `normal`: the outward normal direction for that door (N/E/S/W)
- `approachCell = doorCell + normal` (first corridor tile outside the door)
- `k`: runway length in tiles (default **k = 2** = 20 ft at 10 ft/tile)

### 3.2 Constraint
For a corridor path that connects to this door:
- The final `k` tiles of the corridor must be aligned with `normal`
- Specifically: the corridor must contain a straight segment:
  - `runwayStart = approachCell + normal*(k-1)`
  - then `... -> runwayStart -> ... -> approachCell` moving only in `-normal` direction (toward the door)

### 3.3 Implementation (Recommended Two-Phase Routing)
Instead of routing to `approachCell`, route to `runwayStart`, then append the runway:

1) Pathfind from `srcApproachCell` to `runwayStart`
- Standard A* with ruleset costs
- `runwayStart` must be valid (not blocked, not inside room)

2) Append runway tiles deterministically:
- For i in 0..k-1:
  - carve `runwayStart - normal*i` (or equivalent) until reaching `approachCell`

This guarantees a straight, perpendicular approach even if the main path merged into a spine earlier.

### 3.4 Validity Checks
A door candidate is valid only if:
- `approachCell` is not Blocked and not inside any room
- all runway tiles (`runwayStart .. approachCell`) are not Blocked and not inside any room

If invalid:
- try another door candidate (or reduce k to 1 as fallback)

---

## 4) Anti-Hug Penalty (Soft Constraint)

### 4.1 Goal
Discourage corridor moves that trace along the outside of a room wall.
We only apply this near rooms so general corridor merging remains unaffected.

### 4.2 When to Apply
During A* expansion, when considering a step into `(nx, ny)` with move direction `dirMove`:

If `(nx, ny)` is adjacent (N/E/S/W) to any room boundary/interior tile,
and the move direction is **tangent** (parallel) to that adjacent room wall,
add penalty.

### 4.3 Tangent Detection (Orthogonal Grid)
Let `adjRoomDir` be the direction from `(nx, ny)` to the adjacent room tile:
- If room is to the **East** or **West** of `(nx, ny)`, then the room wall is vertical,
  and **tangent moves** are **North/South**.
- If room is to the **North** or **South**, then the wall is horizontal,
  and **tangent moves** are **East/West**.

So:

- If `adjRoomDir ∈ {E, W}` and `dirMove ∈ {N, S}` => hugging
- If `adjRoomDir ∈ {N, S}` and `dirMove ∈ {E, W}` => hugging

### 4.4 Penalty Value
- `hugPenalty = +60` (should exceed turn penalty so wall-tracing loses)

Apply once per step if *any* hugging condition is met.

Note: do NOT apply hugPenalty inside the final runway segment (the runway is pre-carved / appended).

---

## 5) Interaction with Existing Rules
- Works alongside turn penalties and corridor-merge bonuses.
- Does not forbid corner entries.
- Does not affect corridors far from rooms.
- Runway constraint ensures clean final approach even when the optimal route merges early.

---

## 6) Defaults / Fallbacks
Defaults:
- `k = 2` runway

Fallbacks (if routing fails due to tight geometry):
1) Try alternate door candidates (different walls)
2) Temporarily reduce runway length: `k = 1`
3) As last resort, allow approach without runway for that one connection (log a debug warning)

---

## 7) Acceptance Tests
1) Corridor no longer turns and traces a room wall right before entry.
2) Final approach into `approachCell` is straight and perpendicular for at least `k` tiles.
3) Corner doors are still allowed if their runway tiles are valid.
4) Corridors can still merge into spines away from rooms.

---

## 8) Summary
Implement a **2-tile perpendicular runway** into each door approach cell, and add a **tangent-to-room-wall penalty** within 1 tile of rooms. This prevents “arrival hugging” without banning corner entries.
