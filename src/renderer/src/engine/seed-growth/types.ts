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

// =============================================================================
// Imports
// =============================================================================
import type { ManualSeedConfig, SeedShape, SeedSide, ManualSeedMetadata } from './SeedDefinitions'

// Re-export for convenience if needed, or consumers should import directly.
// For now, we use them in Settings.
export type { ManualSeedConfig, SeedShape, SeedSide, ManualSeedMetadata }

// =============================================================================
// Core Types
// =============================================================================

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
  /** Identifying type string for this room (e.g. "Boss Room", "Manual Seed") */
  type?: string
  /** Active trellis tags for this room */
  trellis?: string[]
  /** ID of the cluster this room belongs to (if any) */
  clusterId?: string
}

// Assuming TrellisPhase, TrellisContext, and RoomSeed are defined elsewhere or will be added.
// This interface definition is added based on the provided snippet.
export interface ITrellis {
  /**
   * Executes the trellis logic for a given phase.
   * @param phase The current phase of trellis execution.
   * @param context The current generation context.
   * @param subject The room or seed being processed (optional).
   * @param args Parsed arguments from the tag string (e.g., #spawn(4,3) -> [4, 3])
   * @returns Dynamic results based on phase (e.g. ManualSeedConfig[] for 'ejection')
   */
  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room, args?: any[]): ManualSeedConfig[] | void
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
}

// =============================================================================
// Dungeon Objects
// =============================================================================

export interface DungeonObject {
  id: string
  type: string // e.g., 'stairs_up', 'chest', 'trap'
  x: number // Grid coordinates
  y: number
  scale?: number
  rotation?: number
  properties?: Record<string, any>
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
  /** If true, primary mirror seeds grow in lockstep */
  symmetryStrictPrimary: boolean
  /** If true, secondary (paired) mirror seeds grow in lockstep */
  symmetryStrictSecondary: boolean

  // --- Room/Corridor Extraction ---
  minRoomArea: number
  maxRoomArea: number // Split rooms larger than this
  maxCorridorWidth: number
  classificationMode: RoomClassificationMode
  /** If true, create visible corridor borders where regions collide */
  collisionCorridors: boolean

  // --- Debug ---
  debug: DebugFlags
}

// =============================================================================
// Generator State
// =============================================================================

export interface SeedGrowthState {
  grid: GridTile[][]
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
  /** Placed objects */
  objects: DungeonObject[]
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
    symmetryStrictPrimary: false,
    symmetryStrictSecondary: false,

    minRoomArea: 9,
    maxRoomArea: 100, // Default: no practical limit
    maxCorridorWidth: 2,
    classificationMode: 'floodFill',
    collisionCorridors: false,

    debug: {
      showRegions: true,
      showFrontier: false,
      showSymmetryAxis: false,
      showRoomBounds: false,
      showCorridors: false,
      showConnectionsGraph: false,
      showGrowthOrder: false
    }
  }
}

// =============================================================================
// Spine-Seed Generator Types
// =============================================================================

export type GeneratorMode = 'organic' | 'spineSeed'

// EjectionSide moved to top for wider reuse, but kept here for reference compat if needed
// export type EjectionSide = ...

export type IntervalMode = 'random' | 'fixed'

export type GrowthDirection = 'all' | 'perpendicular' | 'parallel'

export type CollisionBehavior = 'bothStop' | 'newerStops' | 'olderStops'

export type SpineSeedPhase = 'spine' | 'ejection' | 'roomGrowth' | 'walls' | 'complete'

export interface DungeonData {
  gridWidth: number
  gridHeight: number
  rooms: Room[]
  spine: SpineTile[]
  spineWidth: number
  objects: DungeonObject[]
  seed?: number  // For seeded RNG operations (anti-clustering, etc.)
}

// -----------------------------------------------------------------------------
// Spine Growth Settings
// -----------------------------------------------------------------------------

export interface SpineGrowthSettings {
  /** Maximum number of spine branches (forks) */
  maxForks: number
  /** Maximum number of loop-backs to existing spine */
  maxLoops: number
  /** Width of spine corridor in tiles */
  spineWidth: number
  /** Whether the spine acts as a wall blocking room growth */
  spineActsAsWall: boolean
  // Reuses existing physics: gamma, straightBias, turnPenalty, branchPenalty
}

// -----------------------------------------------------------------------------
// Seed Ejection Settings
// -----------------------------------------------------------------------------

export interface SeedEjectionSettings {
  /** Minimum tiles between seed ejections */
  minInterval: number
  /** Maximum tiles between seed ejections */
  maxInterval: number
  /** Random intervals vs fixed intervals */
  intervalMode: IntervalMode
  /** Minimum distance from spine seed is placed */
  minDistance: number
  /** Maximum distance from spine seed is placed */
  maxDistance: number
  /** Which side(s) of spine to eject seeds */
  ejectionSide: EjectionSide
  /** Send 2 seeds same direction (one farther than the other) */
  pairedEjection: boolean
  /** Chance seed doesn't grow at all (0-1) */
  dudChance: number
  /** Chance to eject a wall-seed instead of room-seed (0-1) */
  wallSeedChance: number
}

// -----------------------------------------------------------------------------
// Room Growth Settings
// -----------------------------------------------------------------------------

export interface RoomGrowthSettings {
  /** Minimum room width */
  minWidth: number
  /** Maximum room width */
  maxWidth: number
  /** Minimum room height */
  minHeight: number
  /** Maximum room height */
  maxHeight: number
  /** Growth direction relative to spine */
  growthDirection: GrowthDirection
  /** What happens when two rooms collide */
  collisionBehavior: CollisionBehavior
}

// -----------------------------------------------------------------------------
// Manual Seed Configuration (Moved to SeedDefinitions.ts)
// -----------------------------------------------------------------------------

// Removed local definitions (MinMax, ManualSeedConfig, etc) to use imports.

// -----------------------------------------------------------------------------
// Spine-Seed Debug Flags
// -----------------------------------------------------------------------------

export interface SpineSeedDebugFlags {
  showSpine: boolean
  showSeeds: boolean
  showRoomGrowth: boolean
  showWalls: boolean
  showCollisions: boolean
  showGrowthOrder: boolean
}

// -----------------------------------------------------------------------------
// Spine-Seed Settings (Complete)
// -----------------------------------------------------------------------------

export interface SpineSeedSettings {
  // --- Core ---
  seed: number
  gridWidth: number
  gridHeight: number
  /** Number of spine starting points */
  seedCount: number
  /** Maximum tiles for spine growth (like organic budget) */
  tileBudget: number

  // --- Spine Growth (uses existing physics) ---
  spine: SpineGrowthSettings
  /** Frontier weight exponent. >1 = blobby, <1 = stringy */
  gamma: number
  /** 0-1, prefer continuing same direction */
  straightBias: number
  /** Force spine to move in a straight line */
  forceStraight: boolean
  /** Override shape: 'N' (Normal), 'S' (S-shape), 'U' (U-shape), 'F' (Forks) */
  turnOverride: 'N' | 'S' | 'U' | 'F'
  /** 0-5, penalty for changing direction */
  turnPenalty: number
  /** 0-5, penalty for creating new branches */
  branchPenalty: number

  // --- Seed Ejection ---
  ejection: SeedEjectionSettings

  // --- Room Growth ---
  roomGrowth: RoomGrowthSettings

  // --- Manual Control ---
  manualSeedQueue?: ManualSeedConfig[]

  // --- Symmetry (same as organic) ---
  symmetry: number
  /** If true, primary mirror seeds grow in lockstep */
  symmetryStrictPrimary: boolean
  /** If true, secondary (paired) mirror seeds grow in lockstep */
  symmetryStrictSecondary: boolean

  // --- Debug ---
  debug: SpineSeedDebugFlags
}

// -----------------------------------------------------------------------------
// Default Spine-Seed Settings Factory
// -----------------------------------------------------------------------------

export function createDefaultSpineSeedSettings(): SpineSeedSettings {
  const gridWidth = 64
  const gridHeight = 64
  const fillPercent = 80 // Increased to 80% by default
  return {
    seed: Math.floor(Math.random() * 1000000),
    gridWidth,
    gridHeight,
    seedCount: 24, // Default to 24 per user request
    tileBudget: Math.floor(gridWidth * gridHeight * fillPercent / 100),

    spine: {
      maxForks: 1,
      maxLoops: 1,
      spineWidth: 1,
      spineActsAsWall: true
    },
    gamma: 1.2,
    straightBias: 0.5,
    forceStraight: true, // User request: Enabled by default
    turnOverride: 'N',
    turnPenalty: 10,
    branchPenalty: 0.8,

    ejection: {
      minInterval: 3,
      maxInterval: 7, // User request: 7
      intervalMode: 'random',
      minDistance: 3,
      maxDistance: 7, // User request: 7
      ejectionSide: 'both',
      pairedEjection: true, // Ensure defaults match user intent (usually true for spine seed)
      dudChance: 0.0,
      wallSeedChance: 0.0
    },

    roomGrowth: {
      minWidth: 3,
      maxWidth: 7, // User request: 7
      minHeight: 3,
      maxHeight: 7, // User request: 7
      growthDirection: 'all',
      collisionBehavior: 'bothStop'
    },

    symmetry: 0,
    symmetryAxis: 'vertical',
    symmetryStrictPrimary: false,
    symmetryStrictSecondary: false,

    debug: {
      showSpine: true,
      showSeeds: true,
      showRoomGrowth: true,
      showWalls: true,
      showCollisions: false,
      showGrowthOrder: false
    }
  }
}

// -----------------------------------------------------------------------------
// Spine Tile (extends grid tile concept)
// -----------------------------------------------------------------------------

export interface SpineTile {
  x: number
  y: number
  /** Order this tile was added to spine */
  spineOrder: number
  /** Direction spine was traveling when this tile was placed */
  direction: Direction
  /** True if this is a fork point */
  isForkPoint: boolean
  /** True if this is a loop connection point */
  isLoopPoint: boolean
  /** Branch ID (0 = main, 1+ = branches) */
  branchId: number
}

// -----------------------------------------------------------------------------
// Room Seed (ejected from spine)
// -----------------------------------------------------------------------------

export interface RoomSeed {
  id: string
  /** Position where seed was ejected */
  position: GridCoord
  /** Spine tile this seed was ejected from */
  sourceSpineTile: GridCoord
  /** Direction from spine to seed */
  ejectionDirection: Direction
  /** Target room dimensions */
  targetWidth: number
  targetHeight: number
  /** True if this is a wall-seed instead of room-seed */
  isWallSeed: boolean
  /** True if seed died (landed on existing room) */
  isDead: boolean
  /** Current room bounds during growth */
  currentBounds: { x: number; y: number; w: number; h: number }
  /** Tiles claimed by this room */
  tiles: GridCoord[]
  /** Growth order for animation */
  birthOrder: number
  /** True if room has finished growing */
  isComplete: boolean
  /** ID of symmetric partner seed (if any) for strict mirrored growth */
  partnerId?: string
  /** Generation type: primary or secondary (paired) */
  generation: 'primary' | 'secondary'
  
  /** Source configuration used to create this seed */
  configSource?: ManualSeedConfig
  tags?: string[]
  content?: ManualSeedMetadata
  /** Grouping for multiple seeds that form a single logical unit */
  clusterId?: string
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

export interface SpineHead {
  x: number
  y: number
  dir: Direction
  waypoints: { x: number; y: number }[]
  isTrunk?: boolean // If true, reaching end triggers fork event
}

export interface SpineSeedState {
  /** 2D grid of tiles (shared format with organic) */
  grid: GridTile[][]

  /** Current generation phase */
  phase: SpineSeedPhase

  /** Spine tiles in order of creation */
  spineTiles: SpineTile[]
  /** Active spine frontier (for growth animation) - DEPRECATED, using head tracking instead */
  spineFrontier: Set<number>
  /** Number of forks created so far */
  forkCount: number
  /** Number of loops created so far */
  loopCount: number
  /** True if spine growth is complete */
  spineComplete: boolean
  /** Current spine head X position */
  spineHeadX?: number
  /** Current spine head Y position */
  spineHeadY?: number
  /** Current spine head direction */
  spineHeadDir?: Direction
  /** Current turn override setting (N, S, U, F) */
  turnOverride?: 'N' | 'S' | 'U' | 'F'
  /** Waypoints for predefined shapes (S, U) */
  waypoints?: { x: number; y: number }[]

  /** Active spine heads for branching growth */
  activeHeads: SpineHead[]

  /** Pre-calculated list of seeds to eject (The Seed Pouch) */
  seedPouch: ManualSeedConfig[]

  /** Room seeds ejected from spine */
  roomSeeds: RoomSeed[]
  /** Index of next spine tile to eject from */
  ejectionIndex: number
  /** Distance counter for next ejection */
  distanceToNextEjection: number
  /** True if ejection phase is complete */
  ejectionComplete: boolean

  /** Active room frontiers keyed by seed ID */
  roomFrontiers: Map<string, Set<number>>
  /** True if all room growth is complete */
  roomGrowthComplete: boolean

  /** Total tiles grown */
  tilesGrown: number
  /** Current step count */
  stepCount: number
  /** True if entire generation is complete */
  isComplete: boolean
  
  /** Placed objects */
  objects: DungeonObject[]
}
