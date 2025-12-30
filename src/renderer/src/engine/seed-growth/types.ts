/**
 * Seed Growth Dungeon Generator - Type Definitions
 * 
 * OPD-inspired growth-based dungeon generation.
 * Geometry emerges from growth behavior, not room placement.
 */

// =============================================================================
// Enums
// =============================================================================

export type TileState = 'empty' | 'floor' | 'blocked'

export type SeedPlacement = 'center' | 'random' | 'symmetricPairs'

export type SymmetryAxis = 'vertical' | 'horizontal'

export type RoomClassificationMode = 'floodFill' | 'thickness'

export type Direction = 'north' | 'south' | 'east' | 'west'

export type MaskToolMode = 'off' | 'paint' | 'erase'

// =============================================================================
// Grid Types
// =============================================================================

export interface GridTile {
  x: number
  y: number
  state: TileState
  regionId: number | null
  /** Growth order timestamp for heatmap visualization */
  growthOrder: number | null
  /** Local thickness for room classification (approach B) */
  thickness?: number
  /** Room ID if classified as room */
  roomId?: string | null
  /** True if this is a corridor tile */
  isCorridor?: boolean
}

export interface GridCoord {
  x: number
  y: number
}

// =============================================================================
// Seeds and Regions
// =============================================================================

export interface Seed {
  id: string
  position: GridCoord
  regionId: number
}

export interface Region {
  id: number
  seedId: string
  /** Set of frontier tile indices (y * width + x) */
  frontier: Set<number>
  /** Current region size in tiles */
  size: number
  /** Last growth direction for straight bias */
  lastDir: Direction | null
  /** Growth priority weight */
  priority: number
}

// =============================================================================
// Room and Corridor Extraction
// =============================================================================

export interface Room {
  id: string
  regionId: number
  tiles: GridCoord[]
  bounds: { x: number; y: number; w: number; h: number }
  area: number
  centroid: GridCoord
  /** True if this room should be rendered as a circle */
  isCircular?: boolean
  /** Original rooms before merge (preserves their IDs, regionIds, etc.) */
  subRooms?: Room[]
  /** True if this room was created by merging overlapping rooms */
  isMerged?: boolean
}

export interface Corridor {
  id: string
  regionId: number
  tiles: GridCoord[]
}

export interface Connection {
  roomA: string
  roomB: string
  /** Corridor connecting them, if any */
  corridorId?: string
}

// =============================================================================
// Debug Flags
// =============================================================================

export interface DebugFlags {
  showRegions: boolean
  showFrontier: boolean
  showSymmetryAxis: boolean
  showRoomBounds: boolean
  showCorridors: boolean
  showConnectionsGraph: boolean
  showGrowthOrder: boolean
  showMask: boolean
}

// =============================================================================
// Generator Settings
// =============================================================================

export interface SeedGrowthSettings {
  // --- Core ---
  seed: number
  gridWidth: number
  gridHeight: number
  tileBudget: number

  // --- Seeds / Regions ---
  seedCount: number
  seedPlacement: SeedPlacement
  minSeedDistance: number

  // --- Growth Physics ---
  /** Frontier weight exponent. >1 = blobby, <1 = stringy */
  gamma: number
  /** 0-1, prefer continuing same direction */
  straightBias: number
  /** 0-5, penalty for changing direction */
  turnPenalty: number
  /** 0-5, penalty for creating new branches */
  branchPenalty: number
  /** 0-4, max non-empty neighbors (Isaac-style loop suppression) */
  neighborLimit: number
  /** Allow loop formations */
  allowLoops: boolean
  /** 0-1, chance to form loops if allowLoops is true */
  loopChance: number

  // --- Symmetry ---
  /** 0-100, probability of mirrored growth */
  symmetry: number
  symmetryAxis: SymmetryAxis
  /** If true, reject growth if mirror blocked. If false, allow solo growth. */
  symmetryStrict: boolean

  // --- Room/Corridor Extraction ---
  minRoomArea: number
  maxCorridorWidth: number
  classificationMode: RoomClassificationMode

  // --- Debug ---
  debug: DebugFlags
}

// =============================================================================
// Generator State
// =============================================================================

export interface SeedGrowthState {
  /** 2D grid of tiles */
  grid: GridTile[][]
  /** 2D blocked mask - true = forbidden cells that growth cannot claim */
  blocked: boolean[][]
  /** Mask version counter for change tracking */
  maskVersion: number
  /** Active regions */
  regions: Map<number, Region>
  /** Placed seeds */
  seeds: Seed[]
  /** Total tiles grown */
  tilesGrown: number
  /** Current growth step */
  stepCount: number
  /** True if growth is complete */
  isComplete: boolean
  /** Reason for completion */
  completionReason: 'budget' | 'exhausted' | 'running' | null
  /** Extracted rooms (post-processing) */
  rooms: Room[]
  /** Extracted corridors (post-processing) */
  corridors: Corridor[]
  /** Room connections graph */
  connections: Connection[]
}

// =============================================================================
// Aspect Stub (Placeholder)
// =============================================================================

export interface AspectStub {
  id: string
  name: string
  /** Modify settings. Currently returns unchanged. */
  apply: (settings: SeedGrowthSettings) => SeedGrowthSettings
}

// =============================================================================
// Default Settings Factory
// =============================================================================

export function createDefaultSettings(): SeedGrowthSettings {
  const gridWidth = 64
  const gridHeight = 64
  const fillPercent = 50
  return {
    seed: Math.floor(Math.random() * 1000000),
    gridWidth,
    gridHeight,
    tileBudget: Math.floor(gridWidth * gridHeight * fillPercent / 100),

    seedCount: 3,
    seedPlacement: 'center',
    minSeedDistance: 10,

    gamma: 1.5,
    straightBias: 0.3,
    turnPenalty: 0.5,
    branchPenalty: 0.3,
    neighborLimit: 3,
    allowLoops: false,
    loopChance: 0.1,

    symmetry: 0,
    symmetryAxis: 'vertical',
    symmetryStrict: false,

    minRoomArea: 9,
    maxCorridorWidth: 2,
    classificationMode: 'floodFill',

    debug: {
      showRegions: true,
      showFrontier: false,
      showSymmetryAxis: false,
      showRoomBounds: false,
      showCorridors: false,
      showConnectionsGraph: false,
      showGrowthOrder: false,
      showMask: true
    }
  }
}
