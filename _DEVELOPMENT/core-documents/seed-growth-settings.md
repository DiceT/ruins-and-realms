# Seed Growth Settings Reference

This document describes all settings for the Seed Growth Dungeon generator.

---

## Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `seed` | number | random | RNG seed for reproducible generation |
| `gridWidth` | number | 64 | Width of the grid in tiles |
| `gridHeight` | number | 64 | Height of the grid in tiles |
| `tileBudget` | number | 50% of grid | Max tiles to grow (fill limit) |

---

## Seed Placement

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `seedCount` | number | 3 | Number of seeds to place |
| `seedPlacement` | enum | "center" | How seeds are positioned |
| `minSeedDistance` | number | 10 | Minimum Manhattan distance between seeds |

**Seed Placement Options:**
- `"center"` - First seed at grid center, others scattered
- `"random"` - All seeds placed randomly with min distance
- `"symmetricPairs"` - Seeds placed as mirrored pairs across axis

---

## Growth Physics

These control how regions expand from their seeds.

| Setting | Range | Default | Effect |
|---------|-------|---------|--------|
| `gamma` | 0-10 | 1.5 | **Shape exponent**. Higher = more compact/blobby. Lower = more stringy/branchy |
| `straightBias` | 0-1 | 0.3 | Preference to continue in same direction. 1 = always straight, 0 = no preference |
| `turnPenalty` | 0-5 | 0.5 | Weight penalty for changing direction. Higher = fewer turns |
| `branchPenalty` | 0-5 | 0.3 | Weight penalty for creating new branches. Higher = fewer branches |
| `neighborLimit` | 1-4 | 3 | Max non-empty neighbors allowed. Lower = more open/Isaac-style |
| `allowLoops` | bool | false | Allow regions to form loops (connect back to self) |
| `loopChance` | 0-1 | 0.1 | Probability of forming a loop when possible |

### Growth Shape Cheat Sheet

| Gamma | Straight Bias | Result |
|-------|---------------|--------|
| High (2-3) | High (0.7-1) | **Large rooms** - compact, square-ish |
| Low (0.5-1) | Low (0-0.3) | **Stringy corridors** - lots of branches |
| Medium (1.5) | Medium (0.3-0.5) | **Organic caves** - balanced |
| Any | High + High Turn Penalty | **Long straight hallways** |

---

## Symmetry

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `symmetry` | 0-100 | 0 | Probability (%) of mirroring each growth step |
| `symmetryAxis` | enum | "vertical" | Mirror axis: `"vertical"` or `"horizontal"` |
| `symmetryStrict` | bool | false | If true, reject growth when mirror blocked |

- **0% symmetry**: Fully organic, asymmetric
- **100% symmetry**: Perfect mirror image
- **50% symmetry**: Partially symmetric with organic breaks

---

## Room/Corridor Classification

After growth completes, tiles are classified into rooms and corridors.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `minRoomArea` | number | 9 | Minimum tiles for a region to be a "room" |
| `maxCorridorWidth` | number | 2 | Max width for a path to be a "corridor" |
| `classificationMode` | enum | "floodFill" | Algorithm: `"floodFill"` or `"thickness"` |

---

## Debug Flags

| Flag | Effect |
|------|--------|
| `showRegions` | Color-code tiles by region ID |
| `showFrontier` | Highlight active frontier tiles |
| `showSymmetryAxis` | Draw symmetry axis line |
| `showRoomBounds` | Draw bounding boxes around rooms |
| `showCorridors` | Highlight corridor tiles |
| `showConnectionsGraph` | Show room connectivity graph |
| `showGrowthOrder` | Heatmap of growth order (first → last) |
| `showMask` | Show blocked tiles as dark overlay |

---

## Future: Per-Seed Settings (Planned)

Each seed could override global settings:

```json
{
  "id": "seed_0",
  "position": { "x": 32, "y": 32 },
  "overrides": {
    "gamma": 2.5,
    "straightBias": 0.9
  }
}
```

This enables "seed pouches" - collections of seeds with different behaviors that can be randomly drawn and planted together.

---

## Presets

Example configurations for common dungeon types:

### Dungeon (Rooms + Corridors)
```json
{ "gamma": 1.8, "straightBias": 0.5, "neighborLimit": 3, "seedCount": 4 }
```

### Cavern (Organic)
```json
{ "gamma": 1.0, "straightBias": 0.2, "allowLoops": true, "loopChance": 0.3 }
```

### Linear (Hub & Spoke)  
```json
{ "gamma": 0.8, "straightBias": 0.9, "turnPenalty": 2.0, "branchPenalty": 1.5 }
```

### Maze (Tight Corridors)
```json
{ "gamma": 0.5, "straightBias": 0.1, "neighborLimit": 2, "maxCorridorWidth": 1 }
```
