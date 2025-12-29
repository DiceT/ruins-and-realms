# Wall Paint UI Spec (Growth Field Mask Editor)
Owner: Architect  
Scope: Dungeon Generator UI (Seed Growth)  
Goal: Let the user “paint walls” (blocked tiles) that constrain/shape growth. This is a debug+authoring tool for layout masks (OPD-style). Walls = forbidden space.

---

## 1) Core Concepts & Terminology
- **Blocked Tile**: A grid cell that growth may never claim. Represents solid rock/void/wall mass.
- **Mask / Blocking Layer**: `blocked[x][y]: boolean` parallel to tile state. This is what we paint.
- **Field**: The current growth canvas (gridW × gridH).
- **Overlay**: Visual layer showing blocked cells (and optionally borders).

Non-goals:
- No fancy wall rendering. This tool only paints the mask that constrains growth.

---

## 2) UX Placement
Add a new panel section inside the existing Dungeon control panel:

### Section Title: **Walls / Mask**
Visible in the same control panel as Seed, Grid, Budget, etc.

Include:
- Mode toggle (Paint/Erase/Off)
- Brush controls
- Shape stamps
- Mask ops (clear/invert/import/export)
- Visualization toggles

---

## 3) Interaction Model (Mouse + Hotkeys)
### 3.1 Modes
User can switch tool mode:
- **Off** (default): normal interaction (hover highlight, etc.)
- **Paint**: mouse paints blocked=true
- **Erase**: mouse paints blocked=false

### 3.2 Painting Behavior
- Mouse down on grid begins stroke.
- Drag continues stroke; fill every visited cell (Bresenham line between last cell and current cell).
- Mouse up ends stroke.

### 3.3 Brush
- Brush sizes: **1, 2, 3, 5** (square footprint), default=1
- Optional: “Circle brush” checkbox (nice-to-have; default off)

### 3.4 Hotkeys
- `B` = Paint mode
- `E` = Erase mode
- `Esc` = Tool Off
- `[` / `]` = Decrease / Increase brush size
- `Shift` (hold) temporarily switches Paint↔Erase while held
- `Ctrl+Z` undo, `Ctrl+Y` redo (mask edits only)

---

## 4) Visual Design
### 4.1 Blocked Tile Overlay
When **Show Mask** enabled:
- Blocked cells are drawn as near-black/rocky overlay (solid fill, high contrast).
- Unblocked cells unchanged.

### 4.2 Mask Edges (Optional but very helpful)
Toggle: **Show Mask Edges**
- Draw thin outline where an unblocked cell neighbors a blocked cell (cardinal adjacency).
- This preview approximates future wall lines.

### 4.3 Cursor Preview
When in Paint/Erase:
- Show a translucent preview of brush footprint at hover cell.

---

## 5) UI Controls (Detailed)
### 5.1 Primary Controls
- **Tool Mode**: segmented buttons
  - Off | Paint | Erase
- **Brush Size**: slider or stepper (1/2/3/5)
- **Show Mask**: checkbox (default ON when tool mode != Off)
- **Show Mask Edges**: checkbox (default OFF)

### 5.2 Shape Stamps (OPD-style “deny space” tools)
Provide quick stamps that paint blocked tiles with one click:
- **Block Border**: blocks outer ring (thickness 1–3)
- **Corridor Channel**: blocks everything except a vertical or horizontal band
  - Params: orientation (V/H), band width (1–6), band offset (center/left/right or numeric)
- **Dogleg Channel**: two bands joined at a corner (L-shape)
  - Params: widths, bend location
- **Rooms Pockets**: blocks everything except N rectangular pockets
  - Params: pocket count, pocket sizes, placement (random/symmetric)
- **Parallel Wings**: blocks to create left and right permitted strips + central blocked spine (or vice versa)
  - Params: wing widths, gutter width

Stamps should be deterministic given current seed, or allow “stamp seed” option.

### 5.3 Mask Operations
Buttons:
- **Clear Mask** (set all blocked=false)
- **Invert Mask** (blocked = !blocked)
- **Randomize Mask** (optional; low priority)
- **Apply Preset** dropdown:
  - None (open)
  - Linear Wing
  - Hub Pocket
  - Parallel Wings
  - Panopticon Skeleton (later)

---

## 6) Data Model & Persistence
### 6.1 In-memory
- `blocked: boolean[][]` size gridW×gridH
- `maskVersion: number` increment on edit (for re-render + caching)
- `undoStack` / `redoStack` store diffs (list of changed cells) per stroke

### 6.2 Copy / Paste (Integrate with your existing Copy/Paste)
Extend existing settings JSON to include mask:
- `maskEncoding`: `"rle"` (default)
- `maskRLE`: string
- `maskW`, `maskH` (for validation)

RLE suggestion:
- Row-major run length encoding of 0/1.
- Example: `"0x12,1x4,0x8,..."`
Alternative: base64 bitset (nice-to-have later).

### 6.3 Grid Resize Rules
When grid size changes:
- Prompt or auto behavior:
  - **Crop** (keep top-left / centered crop)
  - **Scale** (nearest-neighbor) (optional)
  - **Clear** (reset mask)
Default: **Clear** unless user explicitly chooses Crop/Scale.

---

## 7) Generator Integration (Must-Have Rules)
During growth, a tile may be claimed only if:
- `blocked[x][y] === false`
- `tileState[x][y] === Empty` (or whatever your “unclaimed” state is)

Additionally:
- Seeds may not be placed on blocked tiles.
  - If seed placement chooses blocked cell, retry (max attempts) then mark seed as “dead/unplaced”.

Optional (domain tuning later):
- “Hard stop at blocked adjacency” is not required; blocked cells simply refuse claims.

---

## 8) Debug Readouts (Small but valuable)
In the panel, show:
- `Blocked Tiles: N`
- `% Blocked: N / (gridW*gridH)`
- (Optional) “Seeds placed on open cells: X/Y”

Hover tooltip (when tool active):
- `x,y`
- `blocked: true/false`
- `tileState`
- `regionId` (if claimed)

---

## 9) Acceptance Tests
1. Paint mode blocks tiles; growth never claims blocked tiles.
2. Erase mode restores open tiles; growth can claim them on next run.
3. Mask copy/paste reproduces the exact shape.
4. Undo/redo works per stroke.
5. Seeds never spawn on blocked tiles (or they retry).
6. “Show Mask Edges” outlines boundaries correctly.
7. Grid resize handles mask according to chosen rule (clear/crop/scale).

---

## 10) Priority
P0:
- Tool mode (Off/Paint/Erase)
- Brush size
- Show Mask
- Clear Mask
- Generator respects blocked tiles
- Copy/Paste includes mask (RLE)

P1:
- Undo/redo
- Shape stamps: Block Border, Corridor Channel
- Show Mask Edges
- Crop on resize

P2:
- Dogleg channel, Parallel Wings preset, pocket presets
- Bitset encoding
- Scale-on-resize

---
