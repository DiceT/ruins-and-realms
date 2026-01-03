
// =============================================================================
// Manual Seed Queue (Seed Pouch) - Definitions
// =============================================================================

export type RangeOrNumber = number | { min: number; max: number }

export type SeedShape = 'rectangle' | 'circle' // Extendable later

export type SeedSide = 'left' | 'right' | 'both' | 'any' | 'random'

export type DoorType = 'standard' | 'archway' | 'iron_bars' | 'secret' | 'locked' | string
export type TrapType = 'spike_pit' | 'darts' | 'alarm' | 'gas' | 'magic_rune' | string

export interface ManualSeedMetadata {
    // Gameplay
    lootTier?: number
    difficulty?: number
    isTrapped?: boolean
    trapType?: TrapType
    
    // Scoring / Pathfinding
    roomScore?: number // Custom weight for Dijkstra

    // Trellis System
    trellis?: string[]
    
    // Extensible
    [key: string]: any
}

export interface ManualSeedConfig {
    schemaVersion: 1

    // Identity
    id?: string
    type?: string
    tags?: string[]

    // Geometry
    shape?: SeedShape
    width?: RangeOrNumber
    height?: RangeOrNumber

    // Placement
    distance?: RangeOrNumber
    side?: SeedSide
    interval?: RangeOrNumber // Used by Trellises (e.g. #spawn) for spacing

    // Exits / Entrances
    doorType?: DoorType
    isExit?: boolean
    exitType?: string

    // Control
    mandatory?: boolean
    allowMirror?: boolean
    repeat?: number // Expanded during ingestion, never seen by generator

    // Nested Metadata
    metadata?: ManualSeedMetadata

    // Trellis System
    trellis?: string[]
    
    // Cluster (set by SpawnTrellis)
    clusterId?: string

    // Pouch Tracking (1-based index)
    pouchId?: number
}
```
