/**
 * Layer System Index
 * 
 * Centralized exports for the self-contained layer ecosystem.
 * All layers implement ILayer interface for consistent lifecycle management.
 */

// Core interface and types
export * from './ILayer'

// Base layers (z:0-40)
export * from './BackgroundLayer'
export * from './FloorLayer'
export * from './WallLayer'
export * from './ObjectLayer'
export * from './GridLayer'

// Visibility layers (z:50-60)
export * from './VisibilityLayer'

// Debug layers (z:80-90)
export * from './SpineDebugLayer'
export * from './DebugLayer'

// UI layers (z:100)
export * from './LabelLayer'

// Adapters (for converting game types to layer render data)
export * from './LayerAdapters'
