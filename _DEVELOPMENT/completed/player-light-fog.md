# PixiJS Lighting + Fog of War
## Design Doc for Architect

Goal: Implement reliable dungeon visibility in PixiJS with:
- **Player always has a Torch by default**
- Optional checkboxes: **Hooded Lantern**, **Bullseye Lantern**
- Proper separation of:
  - Exploration memory (Fog of War)
  - Current visibility (what you can see now)
  - Light intensity (bright vs dim)

This doc assumes a tile grid (1 tile = 10 ft) but supports per-pixel masks.

---

## Terminology

### Data (authoritative)
- **Explored**: tiles the player has ever seen (persistent)
- **VisibleNow**: tiles visible this frame (ephemeral)
- **LightField**: light intensity (0..1) on tiles/pixels

### Render (what we draw)
- **Scene**: floors/walls/props
- **Entities**: player, NPCs, items
- **Fog Overlay**: hides unexplored, dims explored-not-visible
- **Light Overlay**: bright/dim shaping inside VisibleNow

---

## User Controls

### Equipment (mutually exclusive or additive, your call)
Default: **Torch enabled**
Checkboxes:
- [ ] Hooded Lantern
- [ ] Bullseye Lantern

Recommended behavior:
- Torch is always on unless lantern is enabled.
- If Hooded Lantern checked: Torch off.
- If Bullseye Lantern checked: Torch off.
- If both checked (should be prevented): prefer Bullseye, uncheck Hooded.

UI placement: debug/tool panel.

---

## Light Profiles (estimates, tuned for play)

All distances are **feet**; convert to tiles: `tiles = feet / 10`.

### Torch (default)
- Bright radius: 20 ft (2 tiles)
- Dim radius: 40 ft (4 tiles)
- Shape: radial
- Flicker: subtle (optional)

### Hooded Lantern
- Bright: 30 ft (3 tiles)
- Dim: 60 ft (6 tiles)
- Shape: radial, slightly stronger falloff than torch (cleaner light)

### Bullseye Lantern
- Bright: 60 ft (6 tiles) in a cone
- Dim: 120 ft (12 tiles) in a wider cone
- Shape: directional cone from player facing
- Requires player facing angle (mouse direction or last move vector)

---

## Required Layers (Pixi Containers)

### 1) worldContainer
- Floors, walls, doors, static props
- Always rendered (but may be covered by fog)

### 2) entitiesContainer
- Player sprite
- NPCs/items
- NOTE: Entities are clipped by VisibleNow

### 3) lightingContainer (overlay composite)
Contains:
- **lightSprite**: a Sprite made from a RenderTexture (light RT)
- Blend mode: `MULTIPLY` (or `SCREEN` depending on art style)
- Recommended: MULTIPLY for dark dungeons

### 4) fogContainer (overlay composite)
Contains:
- **fogSprite**: Sprite from RenderTexture (fog RT)
- Blend mode: `MULTIPLY` (or `NORMAL` with alpha)
- Fog should be applied BEFORE or AFTER lighting depending on desired look:
  - Recommended order: world -> fog -> lighting -> entities (masked)

### 5) uiContainer
- Room labels, debug text, tool toggles

---

## Core RenderTextures (RTs)

### A) fogRT (persistent-ish visual output)
Represents:
- Unexplored = fully black
- Explored but not visible now = dark gray
- Visible now = transparent (or lightened)

### B) lightRT (per-frame)
Represents:
- 0..1 intensity for VisibleNow tiles
- Outside VisibleNow should be 0 (no “light through walls”)

### C) visibilityRT (optional, but recommended)
Binary mask:
- VisibleNow = 1
- Not visible = 0
Used to:
- clip entities
- optionally clip lighting contribution

If you skip visibilityRT, you can bake VisibleNow directly into lightRT and fogRT.

---

## Data Structures

Grid sizes:
- `W x H` tiles

Buffers:
- `explored[W][H] : boolean`
- `visibleNow[W][H] : boolean` (cleared every update)
- `light[W][H] : float` (0..1, cleared every update)

Geometry:
- `blocked[W][H] : boolean` (walls, closed doors)
- door state should update `blocked`

---

## Visibility + Light Algorithm

### Step 0: Clear per-frame buffers
- visibleNow = false
- light = 0

### Step 1: Compute VisibleNow (line of sight)
Use one of:
1) **Tile FOV** (recommended): Shadowcasting / Permissive FOV
2) **Ray fan**: cast rays to perimeter points in radius (OK for small radii)

Input:
- player tile
- maximum sight radius = max(dim radius) for active light source
- blocked grid

Output:
- visibleNow tiles

### Step 2: Mark explored
For any tile visibleNow == true:
- explored[tile] = true

### Step 3: Compute LightField inside VisibleNow
For each visible tile within dim radius:
- compute distance to player
- intensity:
  - if dist <= brightR: intensity = 1
  - else if dist <= dimR: intensity = smooth falloff to 0
  - else 0
- For cone lights (bullseye): multiply by angle falloff (see below)
- Set: `light[tile] = max(light[tile], intensity)`

Cone math (bullseye):
- Let `dir` = player facing normalized
- Let `v` = normalized vector player->tile
- `a = dot(dir, v)` (cosine)
- Cone threshold (example):
  - brightCone = cos(20°)
  - dimCone = cos(35°)
- Multiply intensity by:
  - 1 if a >= brightCone
  - smoothstep(dimCone, brightCone, a) if between
  - 0 if a < dimCone

Important: Light MUST be gated by visibleNow to prevent “light through walls”.

---

## Fog of War Rules (visual)

Per tile:
- If explored == false: fog alpha = 1.0 (black)
- Else if explored == true and visibleNow == false: fog alpha = 0.65 (darkened memory)
- Else (visibleNow == true): fog alpha = 0.0 (clear)

Option: add slight texture noise to fog (paper grain) so it doesn’t look like a flat blackout.

---

## Pixi Rendering Implementation

### Approach: Draw masks into RTs using Graphics
We will draw tile-rects (or circles/cones) into RenderTextures.

#### fogRT update
- Clear fogRT
- For each tile:
  - if !explored: draw rect with alpha 1.0
  - else if explored && !visibleNow: draw rect with alpha 0.65
  - else draw nothing

Performance note:
- Drawing every tile each frame can be heavy.
- Optimize by:
  - Only redraw fogRT when explored changes OR visibleNow changes
  - Use chunking (rebuild only dirty regions)
  - Or use a single full-screen dark sprite + “cutouts” with masks (see below)

#### lightRT update
- Clear lightRT (black)
- Draw light shape:
  - Torch/Hooded: radial gradient circle centered on player (in pixels)
  - Bullseye: cone gradient (triangle fan)
- But clip by visibleNow:
  - Easiest: draw per-tile rects with alpha = light[tile]
  - Faster: draw light shape once, then multiply by a visibility mask RT

Recommended pipeline (clean + fast enough):
1) Build **visibilityRT** from visibleNow (white for visible tiles)
2) Build **rawLightRT** from radial/cone gradient shape (no walls)
3) Combine: `lightRT = rawLightRT * visibilityRT`
   - Use a custom filter or blend in a container:
     - render rawLightSprite, then apply visibilitySprite as mask
     - or use MULTIPLY blend into a target RT

Entities masking:
- Apply visibilityRT as a mask to entitiesContainer so enemies/items don’t appear in explored-but-not-visible.

---

## Container + Mask Wiring (Pixi)

### Entities visibility
- Create `visibilityMaskSprite` from visibilityRT
- `entitiesContainer.mask = visibilityMaskSprite`
- Player sprite can be exempt (render player above mask or in separate container)

### Lighting overlay
Two options:

**Option A (simple):**
- Create `lightSprite` from lightRT
- Set `lightSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY`
- Put it over world

**Option B (nicer):**
- Use a base darkness sprite (full-screen black at ~0.85)
- Then “punch out” light by using lightSprite with `SCREEN` or `ADD`
- This feels more torch-like and avoids over-dark floors

Recommended default look:
- DarknessSprite (alpha 0.85) NORMAL
- LightSprite (from lightRT) SCREEN with alpha 1.0
- FogSprite (from fogRT) MULTIPLY over everything except UI

Order:
1) worldContainer
2) fogSprite
3) darknessSprite
4) lightSprite
5) entitiesContainer (masked)
6) uiContainer

---

## Facing for Bullseye Lantern
Need player facing vector:
- If top-down movement: last non-zero movement direction
- If mouse aim: vector from player to mouse world position
- If both: mouse aim wins when active

Store:
- `playerFacingAngleRadians`

---

## Debug Views (must-have)
Toggles:
- [ ] Show VisibleNow tiles (green overlay)
- [ ] Show Explored tiles (blue overlay)
- [ ] Show LightField intensity (heatmap)
- [ ] Show LOS rays (optional)
- [ ] Show active light profile (Torch/Hooded/Bullseye)

---

## Edge Cases / Rules
- Closed doors should be LOS blockers.
- Secret doors: treat as wall (block LOS) until discovered/opened.
- Portcullis/barred door: typically blocks movement; decide if it blocks LOS:
  - Suggested: portcullis blocks movement but allows partial LOS (optional later)
  - For now: treat as LOS blocker for simplicity

---

## Performance Notes
- Tile FOV radius is small (torch dim = 4 tiles), so this is cheap.
- Bullseye dim radius can be 12 tiles. Still manageable with shadowcasting.
- Optimize RT updates:
  - visibilityRT/lightRT: every frame or when player moves/turns
  - fogRT: only when explored changes or visibleNow changes (player moves)

---

## Implementation Checklist

1) Add UI checkboxes: Torch (implicit default), Hooded Lantern, Bullseye Lantern
2) Add light profile selection logic
3) Implement FOV:
   - shadowcasting or ray fan, blocked from wall/closed doors
4) Update buffers: visibleNow, explored, light
5) Build visibilityRT (Graphics tile-rects)
6) Build rawLightRT (radial gradient or cone gradient)
7) Combine into lightRT (mask or multiply)
8) Build fogRT (unexplored + explored-not-visible)
9) Apply masks:
   - entitiesContainer masked by visibilityRT
10) Composite layers in correct order
11) Add debug overlays/toggles

---

## Acceptance Criteria
- Unexplored areas are fully hidden.
- Explored areas remain visible but dim when not currently visible.
- Light does not pass through walls/closed doors.
- Entities (except player) are invisible unless currently visible.
- Switching to Hooded/Bullseye changes illumination radius/shape immediately.
- Bullseye respects facing direction.

---
End.

## Addendum: Explored Area Visibility Rule

### Design Intent
Explored space should never disappear. The player remembers where they’ve been.  
However, **memory is not light**. Explored-but-unlit areas should remain visible, but clearly less readable and less safe than currently lit space.

This reinforces:
- spatial memory
- tension beyond the light radius
- the importance of managing light sources

---

## Updated Visibility Rules

Each tile now falls into **one of three visual states**:

### 1) Unexplored
- Never seen by the player
- **Completely hidden**
- Fog alpha: `1.0` (black)

### 2) Explored but Not Currently Lit
- Seen before, but outside current light/LOS
- **Always visible**, but dimmed
- Rendered at **50% brightness** relative to lit areas
- Fog alpha: `0.5` (or equivalent brightness multiplier)

### 3) Currently Lit (VisibleNow)
- Inside current LOS + light
- Fully visible
- Rendered at **100% brightness**
- Fog alpha: `0.0`

---

## Practical Rendering Interpretation (Pixi)

Instead of fully obscuring explored-but-not-visible tiles:

- **Do not mask them out**
- Apply a brightness multiplier

Recommended approach:
- Use Fog of War overlay to:
  - hide *only* Unexplored tiles
  - darken Explored-but-not-lit tiles to 50%
- Use Light overlay to:
  - bring Lit tiles back up to full brightness

This avoids the common mistake of “black void snapping” and keeps dungeon geography readable.

---

## Revised Fog Overlay Logic

Per tile:

if explored == false:
fogAlpha = 1.0 // hidden
else if visibleNow == false:
fogAlpha = 0.5 // memory dim
else:
fogAlpha = 0.0 // clear

yaml
Copy code

Optionally add:
- slight texture noise to fogAlpha
- subtle desaturation on explored-but-not-lit tiles

---

## Entity Visibility Rule (unchanged)
- Entities are **only drawn in VisibleNow**
- Explored-but-not-lit tiles show *no entities*
- This preserves surprise and threat integrity

---

## Lighting Interaction Summary

| State | Geometry | Light | Entities |
|------|----------|-------|----------|
| Unexplored | Hidden | None | Hidden |
| Explored / Unlit | Visible (50%) | None | Hidden |
| Lit | Visible (100%) | Active | Visible |

---

## Why This Matters
This creates a clean visual language:
- **Light = safety**
- **Memory = uncertainty**
- **Dark = danger**

Players always know *where they are* — but not what’s waiting.

---
End Addendum.